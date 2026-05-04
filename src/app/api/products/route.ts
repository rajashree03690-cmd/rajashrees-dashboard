import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Server-side only: use service role key to bypass RLS
const getSupabase = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
    try {
        const supabase = getSupabase();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limitParam = parseInt(searchParams.get('limit') || '20', 10);

        const MAX_LIMIT = 200;
        const limitCount = Math.min(Math.max(limitParam, 1), MAX_LIMIT);
        const start = (page - 1) * limitCount;
        const end = start + limitCount; // fetch 1 extra for hasMore

        // QUERY 1: Fetch products from master_product
        let dataQuery = supabase
            .from('master_product')
            .select('product_id, name, description, image_url, sku, rating, review_count, subcategory_id, is_Active');

        if (search) {
            dataQuery = dataQuery.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
        }

        const { data: rawProducts, error: productsError } = await dataQuery
            .range(start, end)
            .limit(limitCount + 1);

        if (productsError) throw productsError;

        const hasMore = (rawProducts?.length || 0) > limitCount;
        const pageProducts = hasMore ? rawProducts!.slice(0, limitCount) : (rawProducts || []);

        if (pageProducts.length === 0) {
            return NextResponse.json({ success: true, data: [], total: 0 });
        }

        // QUERY 2: Fetch variants for this page's products
        const productIds = pageProducts.map((p: any) => p.product_id);

        const { data: variants } = await supabase
            .from('product_variants')
            .select('product_id, variant_id, variant_name, sku, saleprice, regularprice, stock, image_url, is_Active, is_trending')
            .in('product_id', productIds)
            .limit(500);

        // Build variant lookup map
        const variantsMap: Record<number, any[]> = {};
        if (variants) {
            for (const v of variants) {
                if (!variantsMap[v.product_id]) variantsMap[v.product_id] = [];
                variantsMap[v.product_id].push(v);
            }
        }

        // Transform
        const finalData = [];
        for (const product of pageProducts) {
            const pVariants = variantsMap[product.product_id] || [];
            const activeVariant = pVariants.find((v: any) => v.is_Active && (v.saleprice > 0 || v.regularprice > 0)) || pVariants[0];

            const sale = activeVariant?.saleprice || activeVariant?.regularprice || 0;
            const reg = activeVariant?.regularprice || sale || 0;
            const has_pricing = !!(sale || reg);

            // Do not skip products without pricing in the admin dashboard,
            // as admins need to see them to fix them.
            // if (!has_pricing) continue;

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
                has_pricing,
                isActive: product.is_Active ?? true,
                is_Active: product.is_Active ?? true,
                variants: (() => {
                    const uMap = new Map();
                    for (const v of pVariants) {
                        let n = v.variant_name?.trim();
                        if (!n || n === '-' || n === 'null') n = 'One Size';
                        if (!uMap.has(n) || (v.stock > 0 && uMap.get(n).stock <= 0)) {
                            uMap.set(n, { ...v, variant_name: n });
                        }
                    }
                    return Array.from(uMap.values()).map((v: any) => ({
                        variant_id: v.variant_id, variant_name: v.variant_name, name: v.variant_name,
                        sku: v.sku, saleprice: v.saleprice || v.regularprice || 0, salePrice: v.saleprice || v.regularprice || 0,
                        regularprice: v.regularprice || v.saleprice || 0, regularPrice: v.regularprice || v.saleprice || 0,
                        stock: v.stock || 0, stock_quantity: v.stock || 0, image_url: v.image_url,
                        isActive: v.is_Active, is_Active: v.is_Active, is_trending: v.is_trending
                    }));
                })()
            });
        }

        let estimatedTotal = finalData.length;

        if (hasMore) {
            if (search) {
                // Count exactly for filtered results (Fresh query to avoid mutated limits)
                let countQuery = supabase
                    .from('master_product')
                    .select('product_id', { count: 'exact', head: true });

                if (search) {
                    countQuery = countQuery.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
                }

                const { count } = await countQuery;
                estimatedTotal = count || Math.max((page * limitCount) + 1, finalData.length);
            } else {
                // Unfiltered total - fast direct count query
                try {
                    const { count } = await supabase
                        .from('master_product')
                        .select('product_id', { count: 'exact', head: true });
                    estimatedTotal = count || estimatedTotal;
                } catch (e) { console.error('Count query failed:', e); }
            }
        } else {
            estimatedTotal = ((page - 1) * limitCount) + finalData.length;
        }

        return NextResponse.json({
            success: true,
            data: finalData,
            total: estimatedTotal,
        });
    } catch (error: any) {
        console.error('Dashboard Products API error:', error);
        return NextResponse.json({
            success: false,
            message: error?.message || 'Failed to fetch products',
            data: [],
            total: 0,
        }, { status: 500 });
    }
}
