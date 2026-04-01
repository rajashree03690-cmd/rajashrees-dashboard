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
        let { wishlist_item_id, variant_id } = body // variant_id might be virtual product_id

        if (!wishlist_item_id && !variant_id) {
            return new Response(
                JSON.stringify({ success: false, message: 'ID required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // --- ID RESOLUTION FOR REMOVE ---
        if (!wishlist_item_id && variant_id) {
            // Check if it's a real variant
            const { data: realVariant } = await supabaseClient
                .from('product_variants')
                .select('variant_id')
                .eq('variant_id', variant_id)
                .maybeSingle()

            if (!realVariant) {
                // Not a direct variant match. Check if it's a product_id.
                // If so, we need to find ANY variants of this product that are in the user's wishlist
                // But first we need the customer's wishlist ID.
                // Lets resolve that first below, then come back to this.
            }
        }
        // -------------------------------

        // 1. Get customer
        const { data: customer } = await supabaseClient
            .from('customers')
            .select('customer_id')
            .eq('auth_id', user.id)
            .maybeSingle()

        if (!customer) throw new Error('Customer not found')

        // 2. Get wishlist
        const { data: wishlist } = await supabaseClient
            .from('wishlist')
            .select('wishlist_id')
            .eq('customer_id', customer.customer_id)
            .maybeSingle()

        if (!wishlist) {
            return new Response(
                JSON.stringify({ success: false, message: 'Wishlist not found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            )
        }

        // 3. Perform Deletion
        let query = supabaseClient
            .from('wishlist_item')
            .delete()
            .eq('wishlist_id', wishlist.wishlist_id)

        if (wishlist_item_id) {
            query = query.eq('wishlist_item_id', wishlist_item_id)
        } else if (variant_id) {
            // Smart Removal Logic:
            // Try removing by exact variant_id
            // If that fails (or returns 0 count? supabase delete doesn't return count easily without select), 
            // we should also try to remove by product_id mapping.
            // Since we can't do complex ORs easily in one delete query without RLS policy complexity or RPC,
            // we'll try to resolve the ID first.

            // Re-check variant validity from earlier step
            const { data: realVariant } = await supabaseClient
                .from('product_variants')
                .select('variant_id')
                .eq('variant_id', variant_id)
                .maybeSingle()

            if (realVariant) {
                query = query.eq('variant_id', variant_id)
            } else {
                // Assume it's a product_id. Find variants of this product.
                const { data: relatedVariants } = await supabaseClient
                    .from('product_variants')
                    .select('variant_id')
                    .eq('product_id', variant_id)

                const variantIds = relatedVariants?.map(v => v.variant_id) || []

                if (variantIds.length > 0) {
                    query = query.in('variant_id', variantIds)
                } else {
                    // No variants found for this ID, so it can't be in wishlist
                    return new Response(
                        JSON.stringify({ success: false, message: 'Item not found in wishlist' }),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                    )
                }
            }
        }

        const { error } = await query
        if (error) throw error

        return new Response(
            JSON.stringify({ success: true, message: 'Item removed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error('Error in wishlist-remove:', error)
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
