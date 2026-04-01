import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return new Response(
                JSON.stringify({ success: false, message: 'Unauthorized' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (authError || !user) {
            return new Response(
                JSON.stringify({ success: false, message: 'Unauthorized' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        const body = await req.json()
        const { cart_item_id } = body

        if (!cart_item_id) {
            return new Response(
                JSON.stringify({ success: false, message: 'cart_item_id is required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // 1. Get customer_id from auth_id
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('customer_id')
            .eq('auth_id', user.id)
            .single()

        if (customerError || !customer) {
            return new Response(
                JSON.stringify({ success: false, message: 'Customer not found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            )
        }

        // 2. Get active cart
        const { data: cart } = await supabaseClient
            .from('cart')
            .select('cart_id')
            .eq('customer_id', customer.customer_id)
            .eq('status', 'active')
            .single()

        if (!cart) {
            return new Response(
                JSON.stringify({ success: false, message: 'No active cart found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            )
        }

        // 3. Delete the cart item (verify it belongs to this customer's cart)
        const { error } = await supabaseClient
            .from('cart_item')
            .delete()
            .eq('cart_item_id', cart_item_id)
            .eq('cart_id', cart.cart_id)

        if (error) throw error

        return new Response(
            JSON.stringify({ success: true, message: 'Item removed from cart' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        console.error('Error removing from cart:', error)
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
