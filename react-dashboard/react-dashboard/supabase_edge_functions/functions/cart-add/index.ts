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
        const { variant_id, quantity = 1 } = body

        if (!variant_id) {
            return new Response(
                JSON.stringify({ success: false, message: 'variant_id is required' }),
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

        // 2. Get or create active cart for this customer
        let { data: cart } = await supabaseClient
            .from('cart')
            .select('cart_id')
            .eq('customer_id', customer.customer_id)
            .eq('status', 'active')
            .single()

        if (!cart) {
            // Create new cart
            const { data: newCart, error: cartError } = await supabaseClient
                .from('cart')
                .insert({
                    customer_id: customer.customer_id,
                    status: 'active'
                })
                .select('cart_id')
                .single()

            if (cartError || !newCart) {
                throw new Error('Failed to create cart')
            }
            cart = newCart
        }

        // 3. Get variant price
        const { data: variant } = await supabaseClient
            .from('product_variants')
            .select('saleprice')
            .eq('variant_id', variant_id)
            .single()

        // 4. Check if item already in cart
        const { data: existing } = await supabaseClient
            .from('cart_item')
            .select('cart_item_id, quantity')
            .eq('cart_id', cart.cart_id)
            .eq('variant_id', variant_id)
            .single()

        if (existing) {
            // Update quantity
            const { error: updateError } = await supabaseClient
                .from('cart_item')
                .update({ quantity: existing.quantity + quantity })
                .eq('cart_item_id', existing.cart_item_id)

            if (updateError) throw updateError
        } else {
            // Insert new item
            const { error: insertError } = await supabaseClient
                .from('cart_item')
                .insert({
                    cart_id: cart.cart_id,
                    variant_id,
                    quantity,
                    price_at_add: variant?.saleprice || 0
                })

            if (insertError) throw insertError
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Item added to cart' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        console.error('Error adding to cart:', error)
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
