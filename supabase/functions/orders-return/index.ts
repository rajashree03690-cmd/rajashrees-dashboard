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
                message: 'Please login to request a return'
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
            .select('order_id, customer_id, order_status')
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
                error: 'Unauthorized to request return for this order'
            }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        if (order.order_status !== 'Delivered') {
            return new Response(JSON.stringify({
                success: false,
                error: `Return can only be requested for Delivered orders. Current status: ${order.order_status}`
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Update order status to 'Return Requested'
        const { error: updateError } = await adminClient
            .from('orders')
            .update({
                order_status: 'Return Requested',
                updated_at: new Date().toISOString()
            })
            .eq('order_id', order_id)

        if (updateError) {
            console.error('❌ Order return request failed:', updateError)
            throw new Error(`Order return request failed: ${updateError.message}`)
        }

        // Add an entry in the returns table
        const { error: returnsError } = await adminClient
            .from('returns')
            .insert({
                order_id: order_id,
                customer_id: customerData.customer_id,
                reason: reason || 'Customer requested return via App',
                status: 'Requested',
            })

        if (returnsError) {
            console.warn('⚠️ Returns insert failed, but order status was updated:', returnsError)
        }

        // Log Order Event
        try {
            await adminClient.from('order_events').insert({
                order_id: order_id,
                event_type: 'return_requested',
                description: `Return requested by customer. Reason: ${reason || 'Not provided'}`,
                metadata: {
                    reason: reason || 'Customer requested return',
                },
                created_by: 'customer',
            })
        } catch (eventError) {
            console.warn('⚠️ order_events insert failed:', eventError)
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Return requested successfully',
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('❌ ORDERS-RETURN ERROR:', error);
        return new Response(JSON.stringify({
            success: false,
            message: `Return request failed: ${error.message}`,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
