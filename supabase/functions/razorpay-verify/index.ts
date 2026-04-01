import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyRazorpayPayment } from '../_shared/razorpay.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Razorpay Payment Verification Edge Function (Hardened)
 * 
 * Called after customer completes Razorpay payment.
 * 
 * Input: { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id }
 * 
 * Flow:
 * 1. Validate all required fields
 * 2. Verify order exists and is in correct state
 * 3. Idempotency: if already paid, return success without re-processing
 * 4. Verify Razorpay signature (HMAC SHA256)
 * 5. Cross-verify payment amount with Razorpay API
 * 6. Update order: payment_status='paid', payment_transaction_id
 * 7. Clear customer's cart
 * 8. Return success
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    try {
        // ─── 1. Parse & Validate Input ────────────────────────────
        let body: any
        try {
            body = await req.json()
        } catch {
            return errorResponse(400, 'Invalid JSON in request body')
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = body

        if (!razorpay_order_id || typeof razorpay_order_id !== 'string') {
            return errorResponse(400, 'razorpay_order_id is required and must be a string')
        }
        if (!razorpay_payment_id || typeof razorpay_payment_id !== 'string') {
            return errorResponse(400, 'razorpay_payment_id is required and must be a string')
        }
        if (!razorpay_signature || typeof razorpay_signature !== 'string') {
            return errorResponse(400, 'razorpay_signature is required and must be a string')
        }
        if (!order_id || typeof order_id !== 'string') {
            return errorResponse(400, 'order_id is required and must be a string')
        }

        // Validate format: Razorpay IDs always start with specific prefixes
        if (!razorpay_order_id.startsWith('order_')) {
            return errorResponse(400, 'Invalid razorpay_order_id format')
        }
        if (!razorpay_payment_id.startsWith('pay_')) {
            return errorResponse(400, 'Invalid razorpay_payment_id format')
        }

        console.log(`🔐 Verifying payment for order ${order_id}:`, {
            razorpay_order_id,
            razorpay_payment_id: razorpay_payment_id.substring(0, 12) + '...',
        })

        // ─── 2. Verify Order Exists & Check State ─────────────────
        const { data: existingOrder, error: fetchError } = await adminClient
            .from('orders')
            .select('order_id, payment_status, payment_transaction_id, total_amount, customer_id, order_status')
            .eq('order_id', order_id)
            .single()

        if (fetchError || !existingOrder) {
            console.error('❌ Order not found:', order_id, fetchError?.message)
            return errorResponse(404, `Order ${order_id} not found`)
        }

        // ─── 3. Idempotency Check ────────────────────────────────
        if (existingOrder.payment_status === 'paid' && existingOrder.payment_transaction_id) {
            console.log(`✅ Order ${order_id} already verified (idempotent). Payment: ${existingOrder.payment_transaction_id}`)
            return successResponse({
                message: 'Payment already verified',
                order_id: existingOrder.order_id,
                payment_status: 'paid',
                already_processed: true,
            })
        }

        // Prevent verification on cancelled/refunded orders
        if (existingOrder.order_status === 'Cancelled') {
            return errorResponse(400, `Order ${order_id} is cancelled. Cannot verify payment.`)
        }
        if (existingOrder.payment_status === 'refunded') {
            return errorResponse(400, `Order ${order_id} is already refunded. Cannot verify payment.`)
        }

        // ─── 4. Verify Razorpay Signature ─────────────────────────
        const isValid = await verifyRazorpayPayment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )

        if (!isValid) {
            console.error('❌ SECURITY: Payment signature verification FAILED for order:', order_id)
            // Log suspicious attempt
            await adminClient.from('orders').update({
                updated_at: new Date().toISOString(),
            }).eq('order_id', order_id)

            return errorResponse(400, 'Payment verification failed. Invalid signature. If money was deducted, it will be refunded automatically.')
        }

        console.log('✅ Payment signature verified for order:', order_id)

        // ─── 5. Cross-verify payment with Razorpay API ────────────
        const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('RAZORPAY_KEY')
        const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || Deno.env.get('RAZORPAY_SECRET')

        if (rzpKeyId && rzpKeySecret) {
            try {
                const auth = btoa(`${rzpKeyId}:${rzpKeySecret}`)
                const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
                    headers: { 'Authorization': `Basic ${auth}` }
                })

                if (paymentRes.ok) {
                    const paymentData = await paymentRes.json()
                    const paidAmountRupees = paymentData.amount / 100

                    // Verify payment status is 'captured' or 'authorized'
                    if (paymentData.status !== 'captured' && paymentData.status !== 'authorized') {
                        console.error(`❌ Payment ${razorpay_payment_id} status is ${paymentData.status}, not captured/authorized`)
                        return errorResponse(400, `Payment is not completed. Status: ${paymentData.status}`)
                    }

                    // Verify amount matches (with ₹1 tolerance for rounding)
                    if (Math.abs(paidAmountRupees - existingOrder.total_amount) > 1) {
                        console.error(`❌ SECURITY: Amount mismatch! Paid: ₹${paidAmountRupees}, Expected: ₹${existingOrder.total_amount}`)
                        return errorResponse(400, `Payment amount mismatch. Paid: ₹${paidAmountRupees}, Expected: ₹${existingOrder.total_amount}`)
                    }

                    console.log(`✅ Payment cross-verified: ₹${paidAmountRupees}, status: ${paymentData.status}`)
                } else {
                    console.warn('⚠️ Could not cross-verify payment with Razorpay API:', paymentRes.status)
                    // Don't fail — signature verification is the primary check
                }
            } catch (crossVerifyError) {
                console.warn('⚠️ Cross-verification failed (non-critical):', crossVerifyError)
            }
        }

        // ─── 6. Update Order with Payment Details ─────────────────
        const { data: updatedOrder, error: updateError } = await adminClient
            .from('orders')
            .update({
                payment_status: 'paid',
                payment_transaction_id: razorpay_payment_id,
                order_status: 'processing',
                updated_at: new Date().toISOString(),
            })
            .eq('order_id', order_id)
            .select('order_id, payment_status, payment_transaction_id, customer_id')
            .single()

        if (updateError) {
            console.error('❌ Failed to update order payment status:', updateError.message)
            return errorResponse(500, `Failed to update order: ${updateError.message}. Payment was successful — please contact support with payment ID: ${razorpay_payment_id}`)
        }

        console.log('✅ Order payment updated:', {
            order_id: updatedOrder.order_id,
            payment_status: updatedOrder.payment_status,
            payment_transaction_id: updatedOrder.payment_transaction_id
        })

        // ─── 7. Clear Customer's Cart ─────────────────────────────
        if (updatedOrder.customer_id) {
            try {
                const { data: userCart } = await adminClient
                    .from('cart')
                    .select('cart_id')
                    .eq('customer_id', updatedOrder.customer_id)
                    .eq('status', 'active')
                    .single()

                if (userCart?.cart_id) {
                    await adminClient
                        .from('cart_item')
                        .delete()
                        .eq('cart_id', userCart.cart_id)

                    console.log('✅ Cart cleared after successful payment')
                }
            } catch (cartError) {
                console.warn('⚠️ Cart clearing failed (non-critical):', cartError)
            }
        }

        // ─── 7b. Log Order Event: Payment Verified ──────────────
        try {
            await adminClient.from('order_events').insert({
                order_id: order_id,
                event_type: 'payment_verified',
                description: `Payment of ₹${existingOrder.total_amount} verified via Razorpay`,
                metadata: {
                    payment_id: razorpay_payment_id,
                    amount: existingOrder.total_amount,
                    method: 'razorpay',
                },
                created_by: 'system',
            })
        } catch (eventError) {
            console.warn('⚠️ order_events insert failed (non-critical):', eventError)
        }

        // ─── 8. Return Success ────────────────────────────────────
        return successResponse({
            message: 'Payment verified and order updated successfully',
            order_id: updatedOrder.order_id,
            payment_status: updatedOrder.payment_status,
        })

    } catch (error: any) {
        console.error('❌ Payment verification error:', error)
        return errorResponse(500, error.message || 'Payment verification failed')
    }
})

// ─── Helper Functions ─────────────────────────────────────────────
function errorResponse(status: number, message: string) {
    return new Response(JSON.stringify({
        success: false,
        error: message
    }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
}

function successResponse(data: Record<string, any>) {
    return new Response(JSON.stringify({
        success: true,
        ...data
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
}
