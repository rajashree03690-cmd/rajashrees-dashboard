require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testNativeFetch() {
    console.log('Testing ALL tables for baseline latency...');

    async function timeQuery(name, queryFn) {
        const st = Date.now();
        const { error } = await queryFn();
        console.log(`${name}: ${Date.now() - st}ms ${error ? 'ERROR' : 'OK'}`);
    }

    try {
        await timeQuery('Categories', () => supabase.from('categories').select('id').limit(1));
        await timeQuery('Customers', () => supabase.from('customers').select('customer_id').limit(1));
        await timeQuery('Product_Variants', () => supabase.from('product_variants').select('variant_id').limit(1));
        await timeQuery('Orders', () => supabase.from('orders').select('order_id').limit(1));
        await timeQuery('Master_Product_Limit_1', () => supabase.from('master_product').select('product_id').limit(1));
        await timeQuery('Master_Product_Limit_20', () => supabase.from('master_product').select('*').limit(20));
        await timeQuery('Master_Product_Aggregate', () => supabase.from('master_product').select('product_id', { count: 'exact', head: true }));
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}
testNativeFetch();
