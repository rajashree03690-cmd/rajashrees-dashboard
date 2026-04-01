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
            .maybeSingle()

        if (customerError || !customer) {
            return new Response(
                JSON.stringify({ success: false, data: [], message: 'Customer profile not found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            )
        }

        // 2. Get wishlist
        const { data: wishlist } = await supabaseClient
            .from('wishlist')
            .select('wishlist_id')
            .eq('customer_id', customer.customer_id)
            .maybeSingle()

        if (!wishlist) {
            return new Response(
                JSON.stringify({ success: true, data: [], message: 'Wishlist is empty' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // 3. Fetch items using live tables
        const { data: wishlistItems, error } = await supabaseClient
            .from('wishlist_item')
            .select(`
                wishlist_item_id,
                variant_id,
                added_at,
                product_variants (
                    variant_id,
                    product_id,
                    variant_name,
                    sku,
                    regularprice,
                    saleprice,
                    image_url,
                    stock,
                    master_product (
                        product_id,
                        name,
                        image_url,
                        description,
                        sku
                    )
                )
            `)
            .eq('wishlist_id', wishlist.wishlist_id)

        if (error) throw error

        const formattedItems = (wishlistItems || []).map(item => {
            const variant = item.product_variants || {}
            const product = variant.master_product || {}

            return {
                wishlist_id: item.wishlist_item_id,
                wishlist_item_id: item.wishlist_item_id,
                variant_id: item.variant_id,
                added_at: item.added_at,
                product_variants: {
                    ...variant,
                    variant_name: variant.variant_name || product.name,
                    image_url: variant.image_url || product.image_url,
                    sku: variant.sku || product.sku
                }
            }
        })

        return new Response(
            JSON.stringify({
                success: true,
                data: formattedItems,
                message: `Found ${formattedItems.length} item(s)`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error: any) {
        console.error('Error in wishlist-items:', error)
        return new Response(
            JSON.stringify({ success: false, data: [], message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
