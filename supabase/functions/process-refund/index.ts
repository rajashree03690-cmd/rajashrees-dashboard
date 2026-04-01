import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Process Refund Edge Function
 * 
 * All orders are prepaid via Razorpay (web + WhatsApp).
 * This function calls Razorpay Refund API and updates order status.
 * 
 * Input: { order_id, refund_amount, return_id?, cancelled_by?, cancellation_reason? }
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { return_id, order_id, refund_amount, cancelled_by, cancellation_reason } = await req.json()

        if (!order_id || !refund_amount) {
            return new Response(JSON.stringify({
                success: false,
                error: 'order_id and refund_amount are required'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Get Razorpay credentials
        const keyId = Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('RAZORPAY_KEY')
        const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || Deno.env.get('RAZORPAY_SECRET')

        if (!keyId || !keySecret) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase secrets.'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Initialize Supabase admin client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Fetch order to get payment_transaction_id (Razorpay payment ID)
        const { data: order, error: orderError } = await adminClient
            .from('orders')
            .select('order_id, payment_transaction_id, total_amount, payment_status, payment_method, source')
            .eq('order_id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(JSON.stringify({
                success: false,
                error: `Order not found: ${orderError?.message || 'No data'}`
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const razorpayPaymentId = order.payment_transaction_id
        if (!razorpayPaymentId) {
            return new Response(JSON.stringify({
                success: false,
                error: `No Razorpay payment ID found for order ${order_id}. The payment may not have been verified yet. Current payment status: ${order.payment_status || 'unknown'}.`
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Validate: don't refund more than paid
        const maxRefund = order.total_amount || 0
        const actualRefund = Math.min(refund_amount, maxRefund)
        const refundAmountPaise = Math.round(actualRefund * 100) // Razorpay uses paise
        const isFullRefund = actualRefund >= maxRefund

        // 2. Call Razorpay Refund API
        const auth = btoa(`${keyId}:${keySecret}`)
        console.log(`💳 Calling Razorpay refund: payment=${razorpayPaymentId}, amount=${refundAmountPaise} paise`)

        const refundResponse = await fetch(
            `https://api.razorpay.com/v1/payments/${razorpayPaymentId}/refund`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: refundAmountPaise,
                    notes: {
                        return_id: String(return_id || ''),
                        order_id: String(order_id),
                        reason: cancellation_reason || 'Refund initiated',
                        cancelled_by: cancelled_by || 'admin',
                    },
                }),
            }
        )

        if (!refundResponse.ok) {
            const refundError = await refundResponse.text()
            console.error('❌ Razorpay refund error:', refundError)
            return new Response(JSON.stringify({
                success: false,
                error: `Razorpay refund failed: ${refundError}`
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const refundData = await refundResponse.json()
        console.log('✅ Razorpay refund successful:', refundData.id)

        // 3. Update return status to 'Refunded' (if return_id provided)
        if (return_id) {
            const { error: returnUpdateError } = await adminClient
                .from('returns')
                .update({
                    status: 'Refunded',
                    refund_amount: actualRefund,
                    updated_at: new Date().toISOString(),
                })
                .eq('return_id', return_id)

            if (returnUpdateError) {
                console.error('Warning: Failed to update return status:', returnUpdateError.message)
            }
        }

        // 4. Update order status
        const orderUpdateFields: Record<string, any> = {
            payment_status: isFullRefund ? 'refunded' : 'partially_refunded',
            refund_status: isFullRefund ? 'refunded' : 'partial',
            refunded_amount: actualRefund,
            updated_at: new Date().toISOString(),
        }
        // Only set order_status to Cancelled on full refund
        if (isFullRefund) {
            orderUpdateFields.order_status = 'Cancelled'
        }
        // Track who cancelled and why
        if (cancelled_by) {
            orderUpdateFields.cancelled_by = cancelled_by
        }
        if (cancellation_reason) {
            orderUpdateFields.cancellation_reason = cancellation_reason
        }

        const { error: orderUpdateError } = await adminClient
            .from('orders')
            .update(orderUpdateFields)
            .eq('order_id', order_id)

        if (orderUpdateError) {
            console.error('Warning: Failed to update order payment status:', orderUpdateError.message)
        }

        // 4b. Insert into order_refunds (existing audit table)
        try {
            await adminClient.from('order_refunds').insert({
                order_id: order_id,
                razorpay_payment_id: razorpayPaymentId,
                razorpay_refund_id: refundData.id,
                refund_amount: actualRefund,
                refund_status: 'processed',
                refund_reason: cancellation_reason || 'Refund initiated',
                is_partial: !isFullRefund,
                initiated_by: cancelled_by || 'admin',
            })
            console.log('✅ Inserted into order_refunds')
        } catch (refundInsertError) {
            console.error('Warning: Failed to insert order_refunds:', refundInsertError)
        }

        // 4c. Insert into order_events (timeline)
        try {
            await adminClient.from('order_events').insert({
                order_id: order_id,
                event_type: isFullRefund ? 'refund_full' : 'refund_partial',
                description: `${isFullRefund ? 'Full' : 'Partial'} refund of ₹${actualRefund} initiated by ${cancelled_by || 'admin'}`,
                metadata: {
                    refund_id: refundData.id,
                    amount: actualRefund,
                    razorpay_status: refundData.status,
                    cancelled_by: cancelled_by || 'admin',
                    reason: cancellation_reason,
                },
                created_by: cancelled_by || 'admin',
            })
            console.log('✅ Inserted into order_events')
        } catch (eventInsertError) {
            console.error('Warning: Failed to insert order_events:', eventInsertError)
        }

        // 5. Trigger refund email notification
        try {
            await adminClient.functions.invoke('order-notification', {
                body: {
                    type: 'refund_initiated',
                    order_id: order_id,
                    refund_amount: actualRefund,
                    refund_id: refundData.id
                }
            })
            console.log('✅ Triggered refund_initiated email')
        } catch (emailError) {
            console.error('Warning: Failed to trigger refund email:', emailError)
        }

        return new Response(JSON.stringify({
            success: true,
            refund_id: refundData.id,
            refund_amount: actualRefund,
            razorpay_status: refundData.status,
            message: `Razorpay refund of ₹${actualRefund} processed successfully`,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Process refund error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Refund processing failed',
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
