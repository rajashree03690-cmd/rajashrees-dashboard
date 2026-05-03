import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Please login to cancel an order'
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !authUser) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid session'
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const requestBody = await req.json()
        const { order_id, reason } = requestBody

        if (!order_id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'order_id is required'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Fetch the customer record for this auth user
        const { data: customerData } = await adminClient
            .from('customers')
            .select('customer_id')
            .eq('auth_id', authUser.id)
            .single()

        if (!customerData) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Customer profile not found'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Verify the order belongs to the customer
        const { data: order, error: orderError } = await adminClient
            .from('orders')
            .select('order_id, customer_id, order_status, payment_status, total_amount')
            .eq('order_id', order_id)
            .single()

        if (orderError || !order) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order not found'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (order.customer_id !== customerData.customer_id) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Unauthorized to cancel this order'
            }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (order.order_status === 'Delivered' || order.order_status === 'Cancelled' || order.order_status === 'Shipped') {
            return new Response(JSON.stringify({
                success: false,
                error: `Order cannot be cancelled in its current state: ${order.order_status}`
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Determine new payment status
        // If they already paid, they get a refund.
        let newPaymentStatus = order.payment_status;
        if (order.payment_status === 'paid' || order.payment_status === 'successful') {
            newPaymentStatus = 'refund_pending';
        } else if (order.payment_status === 'pending_payment' || order.payment_status === 'awaiting_payment') {
            newPaymentStatus = 'cancelled';
        }

        const { error: updateError } = await adminClient
            .from('orders')
            .update({
                order_status: 'Cancelled',
                payment_status: newPaymentStatus,
                cancellation_reason: reason || 'Customer requested cancellation',
                cancelled_by: 'customer',
                updated_at: new Date().toISOString()
            })
            .eq('order_id', order_id)

        if (updateError) {
            console.error('❌ Order cancellation failed:', updateError)
            throw new Error(`Order cancellation failed: ${updateError.message}`)
        }

        // Log Order Event
        try {
            await adminClient.from('order_events').insert({
                order_id: order_id,
                event_type: 'order_cancelled',
                description: `Order cancelled by customer. Reason: ${reason || 'Not provided'}`,
                metadata: {
                    reason: reason || 'Customer requested cancellation',
                    cancelled_by: 'customer',
                },
                created_by: 'customer',
            })
        } catch (eventError) {
            console.warn('⚠️ order_events insert failed:', eventError)
        }

        // If a refund is needed, optionally trigger process-refund here, 
        // or let the admin handle it. Usually admin reviews refund_pending.
        // For now, we leave it in refund_pending state.

        return new Response(JSON.stringify({
            success: true,
            message: 'Order cancelled successfully',
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('❌ ORDERS-CANCEL ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            message: `Order cancellation failed: ${error.message}`,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
