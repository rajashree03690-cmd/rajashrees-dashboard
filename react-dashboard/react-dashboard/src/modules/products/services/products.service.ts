import { supabase } from '@/lib/supabase';
import type { Product, ProductVariant } from '@/types/products';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const productsService = {
    /**
     * Fetch products via server-side API route (bypasses RLS using service role key)
     * Previously queried Supabase directly with anon key which was blocked by RLS
     */    async fetchProductsViaEdgeFunction(page: number = 1, limit: number = 20, search?: string): Promise<{ data: Product[]; total: number; }> {
        try {
            console.log('📡 Fetching products via server API route...');

<<<<<<< HEAD:react-dashboard/react-dashboard/react-dashboard/src/modules/products/services/products.service.ts
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(), // Can be 'all' or a number
            });

            if (search) params.append('search', search);

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/products-list?${params}`,
                {
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                console.error('Edge Function failed:', response.status, response.statusText);
                throw new Error(`Edge Function failed: ${response.statusText}`);
=======
            let url = `/api/products?page=${page}&limit=${limit}`;
            if (search) {
                url += `&search=${encodeURIComponent(search)}`;
>>>>>>> 49c99a2fbeeeca119250e8d253add75db82d413c:src/modules/products/services/products.service.ts
            }

            const response = await fetch(url);
            const result = await response.json();

            if (!response.ok || !result.success) {
                console.error('Products API error:', result.message || response.statusText);
                return { data: [], total: 0 };
            }

            console.log(`✅ API success! Products: ${result.data?.length || 0}, Total: ${result.total}`);
            return { data: result.data || [], total: result.total || 0 };
        } catch (error) {
            console.error('Products fetch error:', error);
            return { data: [], total: 0 };
        }
    },

    /**
     * Fetch product statistics for dashboard summary cards
     */
    async fetchProductStats(): Promise<{
        totalProducts: number;
        variantsLoaded: number;
        lowStockItems: number;
        inventoryValue: number;
    }> {
        try {
            console.log('📊 Fetching product statistics...');

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/product-stats`,
                {
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                console.error('Product stats fetch failed:', response.status);
                throw new Error(`Stats fetch failed: ${response.statusText}`);
            }

            const stats = await response.json();
            console.log('✅ Product stats:', stats);

            return {
                totalProducts: stats.totalProducts || 0,
                variantsLoaded: stats.variantsLoaded || 0,
                lowStockItems: stats.lowStockItems || 0,
                inventoryValue: stats.inventoryValue || 0,
            };
        } catch (error) {
            console.error('Error fetching product stats:', error);
            return {
                totalProducts: 0,
                variantsLoaded: 0,
                lowStockItems: 0,
                inventoryValue: 0,
            };
        }
    },

    /**
     * Fetch all products (simple query)
     */
    async fetchProducts(search?: string, categoryType?: number): Promise<Product[]> {
        let query = supabase
            .from('master_product')
            .select(`
                *,
                category:categories(category_id, name),
                product_variants(*)
            `);

        if (search) {
            query = query.ilike('product_name', `%${search}%`);
        }

        if (categoryType !== undefined) {
            query = query.eq('category_type', categoryType);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching products:', error);
            throw error;
        }

        return data || [];
    },

    /**
     * Fetch product variants
     * Uses manual join method since 'products' view doesn't allow direct foreign key joins
     */
    async fetchProductVariants(): Promise<ProductVariant[]> {
        return this.fetchProductVariantsManual();
    },

    /**
     * Fetch product variants - Manual method (fetch separately and join)
     */
    async fetchProductVariantsManual(): Promise<ProductVariant[]> {
        try {
            // Step 1: Get all variants
            const { data: variants, error: variantsError } = await supabase
                .from('product_variants')
                .select('*');

            if (variantsError) {
                console.error('Variants fetch error:', variantsError);
                return [];
            }

            if (!variants || variants.length === 0) {
                return [];
            }

            // Step 2: Get all products
            const { data: products, error: productsError } = await supabase
                .from('master_product')
                .select('*');

            if (productsError) {
                console.error('Products fetch error:', productsError);
                // Return variants without product details as fallback
                return variants;
            }

            // Step 3: Manual join
            const variantsWithProducts = variants.map((variant: any) => ({
                ...variant,
                products: products?.find((p: any) => p.product_id === variant.product_id) || null
            }));

            // Filter out variants that didn't find a parent product (optional, but cleaner for UI)
            // or keep them if you want to show orphaned variants. Keeping them for now.

            return variantsWithProducts;
        } catch (error) {
            console.error('Error in manual join:', error);
            return [];
        }
    },
};
