import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-razorpay-signature',
}

/**
 * Razorpay Webhook Edge Function
 * 
 * Listens for Razorpay events and updates DB accordingly.
 * This is the SINGLE SOURCE OF TRUTH for payment status changes.
 * 
 * Events handled:
 * - payment.captured → Update order payment_status to 'paid'
 * - payment.failed → Update order payment_status to 'failed'
 * - refund.processed → Update refund_transactions status to 'processed'
 * - refund.failed → Update refund_transactions status to 'failed'
 * 
 * Security: Validates x-razorpay-signature using RAZORPAY_WEBHOOK_SECRET
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.text()
        const signature = req.headers.get('x-razorpay-signature')

        // Validate webhook signature
        const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
        if (webhookSecret && signature) {
            const expectedSignature = createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex')

            if (signature !== expectedSignature) {
                console.error('❌ Invalid webhook signature')
                return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }
            console.log('✅ Webhook signature verified')
        } else {
            console.warn('⚠️ RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification')
        }

        const payload = JSON.parse(body)
        const event = payload.event
        const entity = payload.payload?.payment?.entity || payload.payload?.refund?.entity

        if (!event || !entity) {
            return new Response(JSON.stringify({ error: 'Invalid payload' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log(`📨 Webhook event: ${event}`, { id: entity.id })

        // Initialize Supabase admin client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        switch (event) {
            case 'payment.captured': {
                const paymentId = entity.id
                let orderId = entity.notes?.order_id
                const razorpayOrderId = entity.order_id // The Razorpay Order ID (order_SS...)

                // Fallback: If no order_id in notes (WhatsApp orders), look up by Razorpay Order ID
                if (!orderId && razorpayOrderId) {
                    console.log(`🔍 No order_id in notes. Looking up order by razorpay_order_id or payment_transaction_id: ${razorpayOrderId}`)

                    // Strategy 1: Try razorpay_order_id column
                    const { data: orderByRzpId } = await adminClient
                        .from('orders')
                        .select('order_id')
                        .eq('razorpay_order_id', razorpayOrderId)
                        .maybeSingle()

                    if (orderByRzpId) {
                        orderId = orderByRzpId.order_id
                        console.log(`✅ Found order by razorpay_order_id: ${orderId}`)
                    } else {
                        // Strategy 2: WhatsApp bot may store order_XXX in payment_transaction_id
                        const { data: orderByTxId } = await adminClient
                            .from('orders')
                            .select('order_id')
                            .eq('payment_transaction_id', razorpayOrderId)
                            .maybeSingle()

                        if (orderByTxId) {
                            orderId = orderByTxId.order_id
                            console.log(`✅ Found order by payment_transaction_id (order_XXX): ${orderId}`)
                        }
                    }
                }

                // Strategy 3: If still not found, try looking up by pay_XXX in payment_transaction_id
                // (insert-new-order may have already resolved the payment ID)
                if (!orderId && paymentId) {
                    const { data: orderByPayId } = await adminClient
                        .from('orders')
                        .select('order_id')
                        .eq('payment_transaction_id', paymentId)
                        .maybeSingle()

                    if (orderByPayId) {
                        orderId = orderByPayId.order_id
                        console.log(`✅ Found order by payment_transaction_id (pay_XXX): ${orderId}`)
                    }
                }

                if (!orderId) {
                    console.warn('⚠️ payment.captured: could not find matching order after ALL strategies. Payment:', paymentId, 'RazorpayOrder:', razorpayOrderId)
                    break
                }

                // Update order: set payment_status, store pay_XXX, and preserve razorpay_order_id
                const updatePayload: any = {
                    payment_status: 'paid',
                    payment_transaction_id: paymentId, // Store the actual pay_... ID
                    order_status: 'processing',
                    updated_at: new Date().toISOString(),
                    total_amount: entity.amount / 100, // 🎯 FIX: Sync actual Razorpay captured amount (paise → rupees)
                }
                // Also store razorpay_order_id if not already set
                if (razorpayOrderId) {
                    updatePayload.razorpay_order_id = razorpayOrderId
                }

                const { error: updateError } = await adminClient
                    .from('orders')
                    .update(updatePayload)
                    .eq('order_id', orderId)

                if (updateError) {
                    console.error('❌ Failed to update order on payment.captured:', updateError.message)
                } else {
                    console.log('✅ Order updated: payment_status=paid, order_id=', orderId, 'payment_id=', paymentId)
                }

                // Insert order event
                await adminClient.from('order_events').insert({
                    order_id: orderId,
                    event_type: 'payment_captured',
                    description: `Payment captured via Razorpay (${paymentId})`,
                    metadata: { payment_id: paymentId, amount: entity.amount / 100, method: entity.method, razorpay_order_id: razorpayOrderId },
                    created_by: 'webhook',
                })
                // Trigger order confirmation email
                try {
                    await adminClient.functions.invoke('order-notification', {
                        body: {
                            type: 'order_received',
                            order_id: orderId,
                        }
                    })
                    console.log('✅ Triggered order_received email')
                } catch (emailError) {
                    console.error('Warning: Failed to trigger order confirmation email:', emailError)
                }

                break
            }

            case 'payment.failed': {
                const paymentId = entity.id
                let orderId = entity.notes?.order_id
                const razorpayOrderId = entity.order_id

                // Fallback: If no order_id in notes (WhatsApp orders), look up by Razorpay Order ID
                if (!orderId && razorpayOrderId) {
                    const { data: orderByRzpId } = await adminClient
                        .from('orders')
                        .select('order_id')
                        .eq('razorpay_order_id', razorpayOrderId)
                        .maybeSingle()

                    if (orderByRzpId) {
                        orderId = orderByRzpId.order_id
                    } else {
                        const { data: orderByTxId } = await adminClient
                            .from('orders')
                            .select('order_id')
                            .eq('payment_transaction_id', razorpayOrderId)
                            .maybeSingle()

                        if (orderByTxId) {
                            orderId = orderByTxId.order_id
                        }
                    }
                }

                if (!orderId) break

                const { error } = await adminClient
                    .from('orders')
                    .update({
                        payment_status: 'failed',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('order_id', orderId)

                if (error) {
                    console.error('❌ Failed to update order on payment.failed:', error.message)
                }

                // Insert order event
                await adminClient.from('order_events').insert({
                    order_id: orderId,
                    event_type: 'payment_failed',
                    description: `Payment failed: ${entity.error_description || 'Unknown error'}`,
                    metadata: { payment_id: paymentId, error_code: entity.error_code },
                    created_by: 'webhook',
                })
                break
            }

            case 'refund.processed': {
                const refundId = entity.id
                const paymentId = entity.payment_id
                const orderId = entity.notes?.order_id

                // Update refund_transactions status
                const { error: refundUpdateError } = await adminClient
                    .from('order_refunds')
                    .update({ status: 'processed' })
                    .eq('razorpay_refund_id', refundId)

                if (refundUpdateError) {
                    console.error('❌ Failed to update refund_transactions:', refundUpdateError.message)
                }

                // Insert order event
                if (orderId) {
                    await adminClient.from('order_events').insert({
                        order_id: orderId,
                        event_type: 'refund_completed',
                        description: `Refund of ₹${entity.amount / 100} processed successfully`,
                        metadata: { refund_id: refundId, payment_id: paymentId, amount: entity.amount / 100 },
                        created_by: 'webhook',
                    })

                    // Trigger refund completion email
                    try {
                        await adminClient.functions.invoke('order-notification', {
                            body: {
                                type: 'refund_completed',
                                order_id: orderId,
                                refund_amount: entity.amount / 100,
                                refund_id: refundId,
                            }
                        })
                        console.log('✅ Triggered refund_completed email')
                    } catch (emailError) {
                        console.error('Warning: Failed to trigger refund email:', emailError)
                    }
                }
                break
            }

            case 'refund.failed': {
                const refundId = entity.id
                const orderId = entity.notes?.order_id

                // Update refund_transactions status
                await adminClient
                    .from('order_refunds')
                    .update({ status: 'failed' })
                    .eq('razorpay_refund_id', refundId)

                if (orderId) {
                    await adminClient.from('order_events').insert({
                        order_id: orderId,
                        event_type: 'refund_failed',
                        description: `Refund of ₹${entity.amount / 100} failed`,
                        metadata: { refund_id: refundId },
                        created_by: 'webhook',
                    })
                }
                break
            }

            default:
                console.log(`ℹ️ Unhandled event: ${event}`)
        }

        return new Response(JSON.stringify({ success: true, event }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Webhook error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
