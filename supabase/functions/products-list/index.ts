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
        const search = url.searchParams.get('search')
        const category = url.searchParams.get('category')
        const subcategory = url.searchParams.get('subcategory')
        const trending = url.searchParams.get('trending')
        const minPrice = parseFloat(url.searchParams.get('minPrice') || '0')
        const maxPrice = parseFloat(url.searchParams.get('maxPrice') || '999999')
        const limitParam = url.searchParams.get('limit') || '20'
        const rawPage = url.searchParams.get('page');
        let page = parseInt(rawPage || '1', 10);
        if (isNaN(page) || page < 1) page = 1;

        const MAX_LIMIT = 20
        let limitCount = parseInt(limitParam || '20', 10)
        if (isNaN(limitCount) || limitCount <= 0 || limitCount > MAX_LIMIT || limitParam === 'all') {
            limitCount = MAX_LIMIT
        }

        const start = (page - 1) * limitCount
        const end = start + limitCount  // fetch 1 extra for hasMore

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // ── Resolve subcategory IDs (only if filters provided) ──
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

        // ── QUERY 1: Fetch products
        let dataQuery = supabaseClient
            .from('master_product')
            .select('product_id, name, description, image_url, sku, rating, review_count, subcategory_id')
            .eq('is_Active', true)

        if (filterApplied) {
            if (subcategoryIds.length > 0) {
                dataQuery = dataQuery.in('subcategory_id', subcategoryIds)
            } else {
                dataQuery = dataQuery.eq('product_id', -1) // no match
            }
        }
        if (search) {
            dataQuery = dataQuery.or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
        }

        console.log(`[Timer] Starting Query 1 (Products) for page ${page}...`);
        const q1Start = Date.now();
        const { data: rawProducts, error: productsError } = await dataQuery
            .range(start, end)
            .limit(limitCount + 1)
            .order('product_id', { ascending: false })
        const q1Time = Date.now() - q1Start;
        console.log(`[Timer] Query 1 finished in ${q1Time}ms. Retrieved ${rawProducts?.length} rows.`);

        if (productsError) throw productsError

        const hasMore = (rawProducts?.length || 0) > limitCount
        const pageProducts = hasMore ? rawProducts!.slice(0, limitCount) : (rawProducts || [])

        if (pageProducts.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true, data: [], total: 0,
                    page, limit: limitCount, totalPages: 0, hasMore: false,
                    message: "No products found"
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            )
        }

        // ── QUERY 2: Fetch variants ONLY for this page's products ──
        const productIds = pageProducts.map((p: any) => p.product_id)
        
        console.log(`[Timer] Starting Query 2 (Variants) for ${productIds.length} products...`);
        const q2Start = Date.now();
        const { data: variants } = await supabaseClient
            .from('product_variants')
            .select('product_id, variant_id, variant_name, sku, saleprice, regularprice, stock, image_url, is_Active, is_trending')
            .in('product_id', productIds)
            .eq('is_Active', true)
            .limit(200)
        console.log(`[Timer] Query 2 finished in ${Date.now() - q2Start}ms.`);
        const q2Time = Date.now() - q2Start;

        // ── Build variant lookup map (O(n) single pass) ──
        const variantsMap: Record<number, any[]> = {}
        if (variants) {
            for (const v of variants) {
                if (!variantsMap[v.product_id]) variantsMap[v.product_id] = []
                variantsMap[v.product_id].push(v)
            }
        }

        // ── Transform (single pass, no additional DB calls) ──
        const finalData = []
        for (const product of pageProducts) {
            const pVariants = variantsMap[product.product_id] || []
            const activeVariant = pVariants.find((v: any) => v.is_Active && (v.saleprice > 0 || v.regularprice > 0)) || pVariants[0]

            const sale = activeVariant?.saleprice || activeVariant?.regularprice || 0
            const reg = activeVariant?.regularprice || sale || 0
            const has_pricing = !!(sale || reg)

            if (minPrice !== 0 || maxPrice !== 999999) {
                if (!has_pricing || sale < minPrice || sale > maxPrice) continue
            }

            if (trending === 'true') {
                if (!pVariants.some((v: any) => v.is_trending)) continue
            }

            finalData.push({
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
                price: sale, saleprice: sale, salePrice: sale,
                original_price: reg, regularprice: reg, regularPrice: reg,
                sku: activeVariant?.sku || product.sku,
                variant_id: activeVariant?.variant_id,
                subcategory_id: product.subcategory_id,
                subcategory_name: '-',
                subcategoryName: '-',
                has_pricing,
                isActive: true,
                is_Active: true,
                variants: pVariants.map((v: any) => ({
                    variant_id: v.variant_id, variant_name: v.variant_name, name: v.variant_name,
                    sku: v.sku, saleprice: v.saleprice || v.regularprice || 0, salePrice: v.saleprice || v.regularprice || 0,
                    regularprice: v.regularprice || v.saleprice || 0, regularPrice: v.regularprice || v.saleprice || 0,
                    stock: v.stock || 0, stock_quantity: v.stock || 0, image_url: v.image_url,
                    isActive: v.is_Active, is_Active: v.is_Active, is_trending: v.is_trending
                }))
            })
        }

        const estimatedTotal = hasMore ? Math.max((page * limitCount) + 1, 6935) : ((page - 1) * limitCount) + finalData.length

        return new Response(
            JSON.stringify({
                success: true,
                data: finalData,
                total: trending === 'true' ? finalData.length : estimatedTotal,
                page, limit: limitCount,
                totalPages: Math.ceil(estimatedTotal / limitCount),
                hasMore,
                message: `Products fetched successfully. q1Time: ${q1Time}ms, q2Time: ${q2Time}ms`
            }),
            { 
                headers: { 
                    ...corsHeaders, 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=15, s-maxage=60, stale-while-revalidate=120'
                }, 
                status: 200 
            }
        )
    } catch (error: any) {
        console.error('Products list error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                message: error?.message || "Failed to fetch products",
                code: error?.code,
                data: [], total: 0
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
