import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
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
        const url = new URL(req.url)
        const category = url.searchParams.get('category')
        const subcategory = url.searchParams.get('subcategory')
        const search = url.searchParams.get('search')
        const minPrice = parseFloat(url.searchParams.get('minPrice') || '0')
        const maxPrice = parseFloat(url.searchParams.get('maxPrice') || '999999')
        const limitParam = url.searchParams.get('limit') || '20'
        const page = parseInt(url.searchParams.get('page') || '1')

        // Handle 'all' or numeric limit
        let start = 0
        let end = 19

        if (limitParam === 'all') {
            start = 0
            end = 99999
        } else {
            const limitCount = parseInt(limitParam)
            start = (page - 1) * limitCount
            end = start + limitCount - 1
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Resolve Category / Subcategory
        let subcategoryIds: any[] = []
        let filterApplied = false

        if (subcategory) {
            filterApplied = true
            const { data: subData } = await supabaseClient
                .from('subcategories')
                .select('subcategory_id')
                .ilike('name', subcategory)
                .single()
            if (subData) subcategoryIds = [subData.subcategory_id]
        } else if (category) {
            filterApplied = true
            const categoriesParam = category.split(',').map(c => c.trim().toLowerCase())
            const { data: allCats } = await supabaseClient
                .from('categories')
                .select('id, name')

            const matchedCatIds = allCats
                ?.filter((c: any) => categoriesParam.includes(c.name.toLowerCase()))
                .map((c: any) => c.id) || []

            if (matchedCatIds.length > 0) {
                const { data: subData } = await supabaseClient
                    .from('subcategories')
                    .select('subcategory_id')
                    .in('category_id', matchedCatIds)
                subcategoryIds = subData?.map((s: any) => s.subcategory_id) || []
            }
        }

        // 2. Main Product Query
        let query = supabaseClient
            .from('master_product')
            .select(`
                product_id,
                name,
                description,
                image_url,
                sku,
                rating,
                review_count,
                subcategory_id,
                subcategories (
                    name
                ),
                product_variants (
                    variant_id,
                    variant_name,
                    sku,
                    saleprice,
                    regularprice,
                    stock,
                    image_url,
                    is_Active
                )
            `, { count: 'exact' })
            .eq('is_Active', true)  // ✅ Correct column name with capital A

        // Apply Filters
        if (filterApplied) {
            if (subcategoryIds.length > 0) {
                query = query.in('subcategory_id', subcategoryIds)
            } else {
                // Filter requested but no matching IDs -> return nothing
                query = query.eq('product_id', -1)
            }
        }

        if (search) {
            // Search in master name, master sku, and variant skus
            query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
        }

        const { data: products, count, error } = await query
            .range(start, end)
            .order('name', { ascending: true })

        if (error) throw error

        // 3. Transform Data
        const transformedData = (products || [])
            .map((product: any) => {
                const variants = product.product_variants || []

                // Find best variant with pricing
                const validVariants = variants.filter((v: any) =>
                    v.is_Active &&
                    (v.saleprice > 0 || v.regularprice > 0)
                )

                const activeVariant = validVariants.find((v: any) => v.saleprice > 0) ||
                    validVariants.find((v: any) => v.regularprice > 0) ||
                    validVariants[0] ||
                    variants[0]

                const sale = activeVariant?.saleprice || activeVariant?.regularprice || 0
                const reg = activeVariant?.regularprice || sale || 0

                // Get subcategory name
                let subName = '-'
                if (product.subcategories) {
                    if (Array.isArray(product.subcategories)) {
                        subName = product.subcategories[0]?.name || '-'
                    } else {
                        subName = product.subcategories.name || '-'
                    }
                }

                return {
                    id: product.product_id,
                    product_id: product.product_id,
                    name: product.name,
                    product_name: product.name,
                    title: product.name,
                    description: product.description,
                    image_url: activeVariant?.image_url || product.image_url,
                    imageUrl: activeVariant?.image_url || product.image_url,
                    rating: product.rating || 0,
                    review_count: product.review_count || 0,
                    price: sale,
                    saleprice: sale,
                    salePrice: sale,
                    original_price: reg,
                    regularprice: reg,
                    regularPrice: reg,
                    sku: activeVariant?.sku || product.sku,
                    variant_id: activeVariant?.variant_id,
                    subcategory_id: product.subcategory_id,
                    subcategory_name: subName,
                    subcategoryName: subName,
                    has_pricing: !!(sale || reg),
                    // Include all variants for dashboard/storefront
                    variants: variants.map((v: any) => {
                        const vSale = v.saleprice || v.regularprice || 0
                        const vReg = v.regularprice || vSale || 0
                        return {
                            variant_id: v.variant_id,
                            variant_name: v.variant_name,
                            name: v.variant_name,
                            sku: v.sku,
                            saleprice: vSale,
                            salePrice: vSale,
                            regularprice: vReg,
                            regularPrice: vReg,
                            stock: v.stock || 0,
                            stock_quantity: v.stock || 0,
                            image_url: v.image_url,
                            isActive: v.is_Active,
                            is_Active: v.is_Active
                        }
                    })
                }
            })
            // Apply price filter ONLY if price range is explicitly requested
            .filter((product: any) => {
                // If no price filter requested (default values), include all products
                const isDefaultPriceRange = (minPrice === 0 && maxPrice === 999999)
                if (isDefaultPriceRange) return true

                // Price filter explicitly requested - apply it
                if (!product.has_pricing) return false
                const productPrice = product.saleprice || product.regularprice || 0
                return productPrice >= minPrice && productPrice <= maxPrice
            })

        return new Response(
            JSON.stringify({
                success: true,
                data: transformedData,
                total: count || 0,
                page: page,
                limit: limitParam,
                totalPages: limitParam === 'all' ? 1 : Math.ceil((count || 0) / (parseInt(limitParam) || 20)),
                message: "Products fetched successfully"
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        )
    } catch (error: any) {
        console.error('Products list error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                message: error.message || "Failed to fetch products",
                data: [],
                total: 0
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
})
