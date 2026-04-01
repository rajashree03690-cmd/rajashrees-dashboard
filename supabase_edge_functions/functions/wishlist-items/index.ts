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

        // 1. Get customer_id from auth_id
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

        // 2. Get wishlist for this customer
        const { data: wishlist } = await supabaseClient
            .from('wishlist')
            .select('wishlist_id')
            .eq('customer_id', customer.customer_id)
            .single()

        if (!wishlist) {
            // No wishlist yet
            return new Response(
                JSON.stringify({ success: true, data: [], message: 'Wishlist is empty' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // 3. Fetch wishlist items with product variant details
        const { data: wishlistItems, error } = await supabaseClient
            .from('wishlist_item')
            .select(`
                wishlist_item_id,
                variant_id,
                added_at,
                product_variants (
                    variant_id,
                    product_id,
                    size,
                    color,
                    stock,
                    saleprice,
                    products (
                        product_id,
                        name,
                        mainimage
                    )
                )
            `)
            .eq('wishlist_id', wishlist.wishlist_id)

        if (error) throw error

        // Format response
        const formattedItems = (wishlistItems || []).map(item => ({
            wishlist_item_id: item.wishlist_item_id,
            variant_id: item.variant_id,
            added_at: item.added_at,
            variant: item.product_variants,
        }))

        return new Response(
            JSON.stringify({
                success: true,
                data: formattedItems,
                message: `Found ${formattedItems.length} item(s) in wishlist`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        console.error('Error fetching wishlist:', error)
        return new Response(
            JSON.stringify({ success: false, data: [], message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
