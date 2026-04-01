require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyze() {
    console.log('=== PRODUCT DATA ANALYSIS ===\n');

    // 1. Check if master_product has a sku column
    console.log('--- 1. Does master_product have a SKU column? ---');
    const { data: sampleProduct, error: mpErr } = await supabase
        .from('master_product')
        .select('*')
        .limit(1);
    
    if (mpErr) {
        console.log('Error:', mpErr.message);
    } else if (sampleProduct && sampleProduct.length > 0) {
        const cols = Object.keys(sampleProduct[0]);
        console.log('master_product columns:', cols.join(', '));
        console.log('Has SKU column:', cols.includes('sku') ? 'YES' : 'NO');
    }

    // 2. Check master_product with SKU values (if column exists)
    console.log('\n--- 2. Master products with SKU set ---');
    const { data: mpWithSku, error: mpSkuErr } = await supabase
        .from('master_product')
        .select('product_id, name, sku')
        .not('sku', 'is', null)
        .limit(10);
    
    if (mpSkuErr) {
        console.log('master_product does NOT have sku column or error:', mpSkuErr.message);
    } else {
        console.log(`master_products with non-null SKU: ${mpWithSku?.length || 0}`);
        if (mpWithSku?.length > 0) {
            mpWithSku.forEach(p => console.log(`  - [${p.product_id}] ${p.name} | SKU: ${p.sku}`));
        }
    }

    // 3. Product variants with 0 or null price
    console.log('\n--- 3. Product variants with 0 or null saleprice ---');
    const { data: zeroPriceVariants, error: zpErr } = await supabase
        .from('product_variants')
        .select('variant_id, variant_name, sku, saleprice, regularprice, product_id')
        .or('saleprice.is.null,saleprice.eq.0');
    
    if (zpErr) {
        console.log('Error:', zpErr.message);
    } else {
        console.log(`Variants with 0/null saleprice: ${zeroPriceVariants?.length || 0}`);
        if (zeroPriceVariants?.length > 0) {
            // Also check if they have regularprice
            const alsoNoRegular = zeroPriceVariants.filter(v => !v.regularprice || v.regularprice === 0);
            console.log(`Of those, also no regularprice: ${alsoNoRegular.length}`);
            console.log('\nSample (first 15):');
            zeroPriceVariants.slice(0, 15).forEach(v => 
                console.log(`  - [${v.variant_id}] SKU: ${v.sku} | sale: ${v.saleprice} | regular: ${v.regularprice} | name: ${v.variant_name}`)
            );
        }
    }

    // 4. Total counts
    console.log('\n--- 4. Total Counts ---');
    const { count: totalProducts } = await supabase
        .from('master_product')
        .select('product_id', { count: 'exact', head: true });
    
    const { count: totalVariants } = await supabase
        .from('product_variants')
        .select('variant_id', { count: 'exact', head: true });
    
    const { count: totalCombos } = await supabase
        .from('combo')
        .select('combo_id', { count: 'exact', head: true });

    console.log(`Total master_products: ${totalProducts}`);
    console.log(`Total product_variants: ${totalVariants}`);
    console.log(`Total combos: ${totalCombos}`);

    // 5. Products WITHOUT any variants (orphans)
    console.log('\n--- 5. Products without any variants ---');
    const { data: allProducts } = await supabase
        .from('master_product')
        .select('product_id, name');
    
    const { data: allVariants } = await supabase
        .from('product_variants')
        .select('product_id');
    
    if (allProducts && allVariants) {
        const productIdsWithVariants = new Set(allVariants.map(v => v.product_id));
        const orphanProducts = allProducts.filter(p => !productIdsWithVariants.has(p.product_id));
        console.log(`Products with NO variants: ${orphanProducts.length}`);
        if (orphanProducts.length > 0) {
            orphanProducts.slice(0, 10).forEach(p => 
                console.log(`  - [${p.product_id}] ${p.name}`)
            );
        }
    }

    // 6. Variants with NULL or missing product_id (unmapped)
    console.log('\n--- 6. Variants with null/missing product_id ---');
    const { data: unmappedVariants, error: umErr } = await supabase
        .from('product_variants')
        .select('variant_id, variant_name, sku, product_id')
        .is('product_id', null);
    
    if (umErr) {
        console.log('Error:', umErr.message);
    } else {
        console.log(`Variants with NULL product_id: ${unmappedVariants?.length || 0}`);
        if (unmappedVariants?.length > 0) {
            unmappedVariants.slice(0, 10).forEach(v =>
                console.log(`  - [${v.variant_id}] SKU: ${v.sku} | name: ${v.variant_name}`)
            );
        }
    }

    // 7. Check combo SKUs vs product variant SKUs overlap
    console.log('\n--- 7. SKU mapping overview ---');
    const { data: variantSkus } = await supabase
        .from('product_variants')
        .select('sku')
        .not('sku', 'is', null);
    
    const { data: comboSkus } = await supabase
        .from('combo')
        .select('sku')
        .not('sku', 'is', null);

    const variantSkuSet = new Set((variantSkus || []).map(v => v.sku));
    const comboSkuSet = new Set((comboSkus || []).map(c => c.sku));
    
    console.log(`Unique variant SKUs: ${variantSkuSet.size}`);
    console.log(`Unique combo SKUs: ${comboSkuSet.size}`);
    
    // Check for variants with empty/blank SKU
    const { data: emptySkuVariants } = await supabase
        .from('product_variants')
        .select('variant_id, variant_name, product_id')
        .or('sku.is.null,sku.eq.');
    
    console.log(`Variants with empty/null SKU: ${emptySkuVariants?.length || 0}`);
    if (emptySkuVariants?.length > 0) {
        emptySkuVariants.slice(0, 10).forEach(v =>
            console.log(`  - [${v.variant_id}] name: ${v.variant_name} | product_id: ${v.product_id}`)
        );
    }

    // 8. Check if master_product has its own sku field and some products use it
    console.log('\n--- 8. master_product with SKU but no matching variant ---');
    if (mpWithSku && mpWithSku.length > 0) {
        const mpSkuNotInVariants = mpWithSku.filter(p => !variantSkuSet.has(p.sku));
        console.log(`master_products with SKU NOT in product_variants: ${mpSkuNotInVariants.length}`);
        mpSkuNotInVariants.slice(0, 10).forEach(p =>
            console.log(`  - [${p.product_id}] ${p.name} | SKU: ${p.sku}`)
        );
    }
}

analyze().catch(e => console.error('FATAL:', e));
