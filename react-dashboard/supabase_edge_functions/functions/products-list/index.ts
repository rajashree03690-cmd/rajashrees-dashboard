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
        const category = url.searchParams.get('category')
        const subcategory = url.searchParams.get('subcategory')
        const search = url.searchParams.get('search')
        const page = parseInt(url.searchParams.get('page')) || 1
        const limitCount = parseInt(url.searchParams.get('limit')) || 100
        const start = (page - 1) * limitCount
        const end = start + limitCount - 1

        // Simple query without complex joins to avoid timeout
        let query = supabaseClient
            .from('master_product')
            .select('product_id, name, description, image_url, rating, review_count, subcategory_id', { count: 'exact' })
            .eq('is_Active', true)

        if (search) {
            query = query.ilike('name', `%${search}%`)
        }

        const { data: products, count, error } = await query
            .range(start, end)
            .order('name', { ascending: true })

        if (error) {
            console.error('Error fetching products:', error)
            return new Response(
                JSON.stringify({ error: error.message }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            )
        }

        // Filter by category if provided (supports multiple comma-separated categories)
        let filteredProducts = products || []
        if (category && filteredProducts.length > 0) {
            // Split comma-separated categories
            const categories = category.split(',').map(c => c.trim())

            // Fetch subcategories with category names
            const subcategoryIds = filteredProducts.map(p => p.subcategory_id).filter(Boolean)
            if (subcategoryIds.length > 0) {
                const { data: subcats } = await supabaseClient
                    .from('subcategories')
                    .select('subcategory_id, categories(name)')
                    .in('subcategory_id', subcategoryIds)

                // Filter products matching ANY selected category (OR logic)
                filteredProducts = filteredProducts.filter(p => {
                    const subcat = subcats?.find(s => s.subcategory_id === p.subcategory_id)
                    return categories.includes(subcat?.categories?.name)
                })
            }
        }

        // Filter by subcategory if provided
        if (subcategory && filteredProducts.length > 0) {
            const subcategoryIds = filteredProducts.map(p => p.subcategory_id).filter(Boolean)
            if (subcategoryIds.length > 0) {
                const { data: subcats } = await supabaseClient
                    .from('subcategories')
                    .select('subcategory_id, name')
                    .in('subcategory_id', subcategoryIds)

                filteredProducts = filteredProducts.filter(p => {
                    const subcat = subcats?.find(s => s.subcategory_id === p.subcategory_id)
                    return subcat?.name === subcategory
                })
            }
        }


        // Fetch variants separately (needed for material and price filtering)
        let variants = []
        if (filteredProducts && filteredProducts.length > 0) {
            const productIds = filteredProducts.map(p => p.product_id)
            const { data: variantsData } = await supabaseClient
                .from('product_variants')
                .select('*')
                .in('product_id', productIds)
                .eq('is_Active', true)
            variants = variantsData || []
        }

        // Get filter parameters
        const material = url.searchParams.get('material')
        const price = url.searchParams.get('price')
        const featured = url.searchParams.get('featured')

        // Filter by material/color if provided
        if (material && variants.length > 0) {
            const materialLower = material.toLowerCase()
            const relevantVariants = variants.filter(v => {
                const color = (v.color || '').toLowerCase()
                // Match material keywords in color field
                if (materialLower === 'gold' && (color.includes('gold') && !color.includes('rose'))) return true
                if (materialLower === 'silver' && color.includes('silver')) return true
                if (materialLower === 'rose-gold' && color.includes('rose')) return true
                if (materialLower === 'oxidized' && color.includes('oxidized')) return true
                if (materialLower === 'stone' && color.includes('stone')) return true
                if (materialLower === 'multi-color' && color.includes('multi')) return true
                return false
            })
            const matchingProductIds = [...new Set(relevantVariants.map(v => v.product_id))]
            filteredProducts = filteredProducts.filter(p => matchingProductIds.includes(p.product_id))
        }

        // Filter by price range if provided (format: "min-max")
        if (price && variants.length > 0) {
            const [minPrice, maxPrice] = price.split('-').map(p => parseFloat(p) || 0)
            const relevantVariants = variants.filter(v => {
                const salePrice = v.saleprice || v.regularprice || 0
                return salePrice >= minPrice && salePrice <= maxPrice
            })
            const matchingProductIds = [...new Set(relevantVariants.map(v => v.product_id))]
            filteredProducts = filteredProducts.filter(p => matchingProductIds.includes(p.product_id))
        }

        // Sort by featured criteria
        if (featured) {
            if (featured === 'bestsellers') {
                filteredProducts.sort((a, b) => (b.review_count || 0) - (a.review_count || 0))
            } else if (featured === 'trending' || featured === 'new') {
                filteredProducts.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
            }
        }



        // Fetch variants separately
        if (filteredProducts && filteredProducts.length > 0) {
            const productIds = filteredProducts.map(p => p.product_id)
            const { data: variants } = await supabaseClient
                .from('product_variants')
                .select('*')
                .in('product_id', productIds)
                .eq('is_Active', true)

            const transformedData = filteredProducts.map(product => {
                const productVariants = variants?.filter(v => v.product_id === product.product_id) || []
                const activeVariant = productVariants[0]

                return {
                    id: product.product_id,
                    catalogue_id: product.product_id,
                    product_id: product.product_id,
                    product_name: product.name,
                    title: product.name,
                    description: product.description,
                    sku: activeVariant?.sku || product.sku || `SKU-${product.product_id}`,
                    image_url: activeVariant?.image_url || product.image_url || 'https://via.placeholder.com/400',
                    price: activeVariant?.saleprice || 2500,
                    original_price: activeVariant?.regularprice || 3000,
                    regularprice: activeVariant?.regularprice || 3000,
                    rating: product.rating || 4.5,
                    review_count: product.review_count || 0,
                    variant_id: activeVariant?.variant_id,
                    variant_count: productVariants.length,
                    color: activeVariant?.color,
                    size: activeVariant?.size
                }
            })

            return new Response(
                JSON.stringify({
                    success: true,
                    data: transformedData,
                    total: filteredProducts.length, // Use filtered count
                    page: page,
                    limit: limitCount,
                    totalPages: Math.ceil(filteredProducts.length / limitCount),
                    message: "Products fetched successfully"
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                }
            )
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: [],
                total: 0,
                page,
                limit: limitCount,
                totalPages: 0
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
                data: [],
                total: 0,
                page: 1,
                limit: 100
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        )
    }
})
