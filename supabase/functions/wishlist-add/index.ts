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
        let { variant_id } = body

        if (!variant_id) {
            return new Response(
                JSON.stringify({ success: false, message: 'variant_id is required' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // --- ID RESOLUTION & SELF-HEALING (Using Live Tables) ---
        const { data: realVariant } = await supabaseClient
            .from('product_variants')
            .select('variant_id, product_id')
            .eq('variant_id', variant_id)
            .maybeSingle()

        if (realVariant) {
            variant_id = realVariant.variant_id
        } else {
            const { data: masterProduct } = await supabaseClient
                .from('master_product')
                .select('product_id, name, sku, image_url, saleprice, regularprice')
                .eq('product_id', variant_id)
                .maybeSingle()

            if (masterProduct) {
                const { data: existingVariants } = await supabaseClient
                    .from('product_variants')
                    .select('variant_id')
                    .eq('product_id', masterProduct.product_id)
                    .limit(1)

                if (existingVariants && existingVariants.length > 0) {
                    variant_id = existingVariants[0].variant_id
                    console.log(`Resolved virtual ID ${body.variant_id} to existing live variant ${variant_id}`)
                } else {
                    console.log(`Creating recovery live variant for product ${masterProduct.product_id}`)
                    const sale = masterProduct.saleprice || 0;
                    const reg = masterProduct.regularprice || 0;

                    const { data: newVariant, error: createError } = await supabaseClient
                        .from('product_variants')
                        .insert({
                            product_id: masterProduct.product_id,
                            variant_name: 'Standard',
                            sku: masterProduct.sku ? `${masterProduct.sku}-VAR` : `SKU-${masterProduct.product_id}`,
                            saleprice: sale > 0 ? sale : 0,
                            regularprice: reg > 0 ? reg : 0,
                            stock: 50,
                            is_active: true,
                            image_url: masterProduct.image_url
                        })
                        .select('variant_id')
                        .single()

                    if (createError) throw new Error(`Failed to create recovery live variant: ${createError.message}`)
                    variant_id = newVariant.variant_id
                }
            } else {
                return new Response(
                    JSON.stringify({ success: false, message: 'Invalid product or variant ID' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
                )
            }
        }
        // ------------------------------------

        // 1. Get customer
        const { data: customer, error: customerError } = await supabaseClient
            .from('customers')
            .select('customer_id')
            .eq('auth_id', user.id)
            .maybeSingle()

        if (customerError || !customer) {
            return new Response(
                JSON.stringify({ success: false, message: 'Customer profile not found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            )
        }

        // 2. Get/Create wishlist
        let { data: wishlist } = await supabaseClient
            .from('wishlist')
            .select('wishlist_id')
            .eq('customer_id', customer.customer_id)
            .maybeSingle()

        if (!wishlist) {
            const { data: newWishlist, error: wError } = await supabaseClient
                .from('wishlist')
                .insert({ customer_id: customer.customer_id })
                .select('wishlist_id')
                .single()

            if (wError) throw wError
            wishlist = newWishlist
        }

        // 3. Check / Add to wishlist
        const { data: existing } = await supabaseClient
            .from('wishlist_item')
            .select('wishlist_item_id')
            .eq('wishlist_id', wishlist.wishlist_id)
            .eq('variant_id', variant_id)
            .maybeSingle()

        if (existing) {
            return new Response(
                JSON.stringify({ success: true, message: 'Item already in wishlist', resolved_variant_id: variant_id }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        const { error: insertError } = await supabaseClient
            .from('wishlist_item')
            .insert({
                wishlist_id: wishlist.wishlist_id,
                variant_id: variant_id
            })

        if (insertError) throw insertError

        return new Response(
            JSON.stringify({ success: true, message: 'Item added to wishlist', resolved_variant_id: variant_id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        console.error('Error in wishlist-add:', error)
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
