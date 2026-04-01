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
                JSON.stringify({ success: false, data: [], message: 'Unauthorized' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
            authHeader.replace('Bearer ', '')
        )

        if (authError || !user) {
            return new Response(
                JSON.stringify({ success: false, data: [], message: 'Unauthorized' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
            )
        }

        // 1. Get customer
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('customer_id')
            .eq('auth_id', user.id)
            .single()

        if (customerError || !customer) {
            return new Response(
                JSON.stringify({ success: false, data: [], message: 'Customer not found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            )
        }

        // 2. Get active cart
        const { data: cart } = await supabaseClient
            .from('cart')
            .select('cart_id')
            .eq('customer_id', customer.customer_id)
            .eq('status', 'active')
            .maybeSingle()

        if (!cart) {
            return new Response(
                JSON.stringify({ success: true, data: [], message: 'Cart is empty' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // 3. Fetch items using live tables
        const { data: cartItems, error } = await supabaseClient
            .from('cart_item')
            .select(`
                cart_item_id,
                variant_id,
                quantity,
                price_at_add,
                added_at,
                product_variants (
                    variant_id,
                    product_id,
                    size,
                    color,
                    stock,
                    saleprice,
                    regularprice,
                    sku,
                    variant_name,
                    image_url,
                    master_product (
                        product_id,
                        name,
                        image_url
                    )
                )
            `)
            .eq('cart_id', cart.cart_id)

        if (error) throw error

        const formattedItems = (cartItems || []).map(item => ({
            cart_item_id: item.cart_item_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            price_at_add: item.price_at_add,
            added_at: item.added_at,
            product_variants: {
                ...item.product_variants,
                stock: item.product_variants?.stock || 0,
                salePrice: item.product_variants?.saleprice || 0,
                regularPrice: item.product_variants?.regularprice || 0
            }
        }))

        // Calculate total amount dynamically based on current sale price
        const totalAmount = formattedItems.reduce((sum, item) => {
            const price = item.product_variants?.saleprice || item.product_variants?.regularprice || 0
            return sum + (price * item.quantity)
        }, 0)

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    items: formattedItems,
                    total_amount: totalAmount,
                    cart_count: formattedItems.length
                },
                message: `Found ${formattedItems.length} item(s)`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error: any) {
        console.error('Error in cart-items:', error)
        return new Response(
            JSON.stringify({ success: false, data: [], message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
