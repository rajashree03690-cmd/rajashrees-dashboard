import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { getAdminClient } from "../_shared/db.ts"
import { verifyRazorpayPayment } from "../_shared/razorpay.ts"

/**
 * Verify Razorpay Payment
 * Called from frontend after successful payment
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            order_number
        } = await req.json()

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !order_number) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Missing payment verification details'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Verify signature
        const isValid = await verifyRazorpayPayment(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        )

        if (!isValid) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Payment verification failed'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Update order payment status
        const adminClient = getAdminClient()
        const { data: order, error: updateError } = await adminClient
            .from('orders')
            .update({
                payment_status: 'paid',
                order_status: 'confirmed',
                updated_at: new Date().toISOString()
            })
            .eq('order_number', order_number)
            .select()
            .single()

        if (updateError) {
            throw new Error('Failed to update order status')
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Payment verified successfully',
            data: {
                order_id: order.order_id,
                order_number: order.order_number,
                payment_status: order.payment_status,
                order_status: order.order_status
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Payment verification error:', error)
        return new Response(JSON.stringify({
            success: false,
            message: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
