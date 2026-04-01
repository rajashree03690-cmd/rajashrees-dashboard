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
        const { variant_id } = body

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

        // 2. Get or create wishlist for this customer
        let { data: wishlist } = await supabaseClient
            .from('wishlist')
            .select('wishlist_id')
            .eq('customer_id', customer.customer_id)
            .single()

        if (!wishlist) {
            // Create new wishlist
            const { data: newWishlist, error: wishlistError } = await supabaseClient
                .from('wishlist')
                .insert({ customer_id: customer.customer_id })
                .select('wishlist_id')
                .single()

            if (wishlistError || !newWishlist) {
                throw new Error('Failed to create wishlist')
            }
            wishlist = newWishlist
        }

        // 3. Check if item already in wishlist
        const { data: existing } = await supabaseClient
            .from('wishlist_item')
            .select('wishlist_item_id')
            .eq('wishlist_id', wishlist.wishlist_id)
            .eq('variant_id', variant_id)
            .single()

        if (existing) {
            return new Response(
                JSON.stringify({ success: true, message: 'Item already in wishlist' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // 4. Add to wishlist
        const { error: insertError } = await supabaseClient
            .from('wishlist_item')
            .insert({
                wishlist_id: wishlist.wishlist_id,
                variant_id
            })

        if (insertError) throw insertError

        return new Response(
            JSON.stringify({ success: true, message: 'Item added to wishlist' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
    } catch (error) {
        console.error('Error adding to wishlist:', error)
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
