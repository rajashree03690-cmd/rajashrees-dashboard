require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function analyze() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Find products that look like standalone variants (ending in " - 2.8", " - 2.4", etc)
    const { data: products } = await supabase
        .from('master_product')
        .select('product_id, name, sku, category_id, subcategory_id')
        .or('name.ilike.% - 2.%,name.ilike.% - 3.%');
        
    console.log(`Found ${products?.length || 0} potential standalone variants.`);
    
    // Group them by base name
    const grouped = {};
    for (const p of products || []) {
        // Extract base name by removing the size suffix
        const match = p.name.match(/(.+) - \d\.\d+$/);
        const baseName = match ? match[1] : null;
        
        if (baseName) {
            if (!grouped[baseName]) grouped[baseName] = [];
            grouped[baseName].push(p);
        }
    }
    
    // Show some examples
    let count = 0;
    for (const [baseName, items] of Object.entries(grouped)) {
        if (items.length > 1) {
            console.log(`\nBase: ${baseName}`);
            items.forEach(i => console.log(`  - ID: ${i.product_id}, SKU: ${i.sku}, Name: ${i.name}`));
            count++;
            if (count > 5) break; 
        }
    }
    
    // Also check for 0 price variants
    const { data: zeroPrice } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('saleprice', 0)
        .eq('regularprice', 0);
        
    console.log(`\nFound ${zeroPrice?.length || 0} variants with 0 price.`);
}
analyze();
