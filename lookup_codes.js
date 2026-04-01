require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function lookupCodes() {
    const codes = ['9111', '9177', 'MAT9096', '9113', '5139', 'FCM5146'];

    for (const code of codes) {
        console.log(`\n=== Code: ${code} ===`);

        // 1. Exact match in product_variants.sku
        const { data: exactVariant } = await supabase
            .from('product_variants')
            .select('variant_id, sku, variant_name, product_id, saleprice')
            .eq('sku', code)
            .limit(3);
        console.log('Exact variant SKU match:', exactVariant?.length || 0, exactVariant ? JSON.stringify(exactVariant) : '');

        // 2. Partial match (contains) in product_variants.sku
        const { data: partialVariant } = await supabase
            .from('product_variants')
            .select('variant_id, sku, variant_name, product_id')
            .ilike('sku', `%${code}%`)
            .limit(5);
        console.log('Partial variant SKU match:', partialVariant?.length || 0);
        if (partialVariant?.length > 0) {
            partialVariant.forEach(v => console.log(`  - [${v.variant_id}] SKU: ${v.sku} | name: ${v.variant_name}`));
        }

        // 3. Exact match in master_product.sku
        const { data: exactMaster } = await supabase
            .from('master_product')
            .select('product_id, name, sku')
            .eq('sku', code)
            .limit(3);
        console.log('Exact master_product SKU match:', exactMaster?.length || 0, exactMaster ? JSON.stringify(exactMaster) : '');

        // 4. Check if code is a product_id
        const numCode = parseInt(code, 10);
        if (!isNaN(numCode)) {
            const { data: byId } = await supabase
                .from('master_product')
                .select('product_id, name, sku')
                .eq('product_id', numCode)
                .limit(1);
            console.log('Match by product_id:', byId?.length || 0, byId ? JSON.stringify(byId) : '');
        }

        // 5. Partial match in master_product.sku
        const { data: partialMaster } = await supabase
            .from('master_product')
            .select('product_id, name, sku')
            .ilike('sku', `%${code}%`)
            .limit(5);
        console.log('Partial master_product SKU match:', partialMaster?.length || 0);
        if (partialMaster?.length > 0) {
            partialMaster.forEach(p => console.log(`  - [${p.product_id}] ${p.name} | SKU: ${p.sku}`));
        }
    }

    // Also check: what does a typical SKU look like?
    console.log('\n=== Sample SKUs in product_variants ===');
    const { data: samples } = await supabase
        .from('product_variants')
        .select('sku')
        .not('sku', 'is', null)
        .limit(20);
    if (samples) {
        console.log(samples.map(s => s.sku).join(', '));
    }
}

lookupCodes().catch(e => console.error('ERROR:', e));
