require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
    console.log('Testing master_product query...');
    const start = Date.now();
    try {
        let dataQuery = supabase
            .from('master_product')
            .select('product_id, name, description, image_url, sku, rating, review_count, subcategory_id')
            .eq('is_Active', true);

        // Simulated from website/dashboard
        const { data: rawProducts, error: productsError } = await dataQuery
            .range(0, 20)
            .limit(21)
            .order('product_id', { ascending: false });

        if (productsError) {
            console.error('Error:', productsError);
        } else {
            console.log(`Success! Fetched ${rawProducts.length} rows`);
        }
    } catch (e) {
        console.error('Exception:', e.message);
    }
    console.log(`Time taken: ${Date.now() - start}ms`);
}

testQuery();
