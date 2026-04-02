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
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        // 1. Fetch Product
        const { data: product, error: productError } = await supabaseClient
            .from('master_product')
            .select('*')
            .eq('product_id', productId)
            .single()

        if (productError || !product) {
            return new Response(
                JSON.stringify({ error: 'Product not found' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
            )
        }

        // 2. Fetch Variants
        const { data: variants } = await supabaseClient
            .from('product_variants')
            .select('*')
            .eq('product_id', productId)
            .order('variant_name', { ascending: true })

        // 3. Transform & Robust Pricing
        let finalVariants = (variants || []).map((v: any) => {
            const sale = v.saleprice || v.regularprice || 0
            const reg = v.regularprice || sale || 0
            return {
                variant_id: v.variant_id,
                variant_name: v.variant_name || 'Standard',
                sku: v.sku,
                saleprice: sale,
                regularprice: reg,
                salePrice: sale, // For frontend
                regularPrice: reg, // For frontend
                stock: v.stock || 0,
                image_url: v.image_url || product.image_url,
                is_Active: v.is_Active,
                isActive: v.is_Active
            }
        })

        if (finalVariants.length === 0) {
            const sale = product.saleprice || product.regularprice || 0
            const reg = product.regularprice || sale || 0
            finalVariants = [{
                variant_id: product.product_id,
                variant_name: 'Standard',
                sku: product.sku || `SKU-${product.product_id}`,
                saleprice: sale,
                regularprice: reg,
                salePrice: sale,
                regularPrice: reg,
                stock: 10,
                image_url: product.image_url,
                is_Active: true,
                isActive: true
            }]
        }

        // Find best default variant
        const defaultVariant = finalVariants.find(v => v.isActive && v.salePrice > 0)
            || finalVariants.find(v => v.salePrice > 0)
            || finalVariants[0]

        // 4. Resolve Categories
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
            subcategoryName: subcategoryName, // Sync
            variants: finalVariants,
            price: defaultVariant.salePrice,
            original_price: defaultVariant.regularPrice,
            regularPrice: defaultVariant.regularPrice,
            salePrice: defaultVariant.salePrice
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: transformedProduct,
                message: "Product fetched successfully"
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ success: false, message: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
