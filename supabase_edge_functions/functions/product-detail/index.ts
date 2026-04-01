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

        const url = new URL(req.url)
        const productId = url.searchParams.get('id')

        if (!productId) {
            return new Response(
                JSON.stringify({ error: 'Product ID is required' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        // Fetch product details
        const { data: product, error: productError } = await supabaseClient
            .from('master_product')
            .select('product_id, name, description, sku, image_url, rating, review_count, subcategory_id')
            .eq('product_id', productId)
            .eq('is_Active', true)
            .single()

        if (productError || !product) {
            return new Response(
                JSON.stringify({ error: 'Product not found' }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                }
            )
        }

        // Fetch all variants for this product
        const { data: variants } = await supabaseClient
            .from('product_variants')
            .select('*')
            .eq('product_id', productId)
            .eq('is_Active', true)

        // Fetch category info via subcategory
        let categoryName = null
        let subcategoryName = null
        if (product.subcategory_id) {
            const { data: subcat } = await supabaseClient
                .from('subcategories')
                .select('name, categories(name)')
                .eq('subcategory_id', product.subcategory_id)
                .single()

            if (subcat) {
                subcategoryName = subcat.name
                categoryName = subcat.categories?.name
            }
        }

        // Transform data
        const transformedProduct = {
            id: product.product_id,
            product_id: product.product_id,
            name: product.name,
            product_name: product.name,
            description: product.description,
            sku: product.sku,
            image_url: product.image_url,
            rating: product.rating || 4.5,
            review_count: product.review_count || 0,
            category: categoryName,
            subcategory: subcategoryName,
            variants: (variants || []).map(v => ({
                variant_id: v.variant_id,
                variant_name: v.variant_name,
                sku: v.sku,
                saleprice: v.saleprice,
                regularprice: v.regularprice,
                stock: v.stock,
                image_url: v.image_url,
                is_Active: v.is_Active
            }))
        }

        // Add price info from first variant
        if (variants && variants.length > 0) {
            transformedProduct.price = variants[0].saleprice
            transformedProduct.original_price = variants[0].regularprice
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: transformedProduct,
                message: "Product fetched successfully"
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error) {
        console.error('Unexpected error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                message: error.message,
                data: null
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
