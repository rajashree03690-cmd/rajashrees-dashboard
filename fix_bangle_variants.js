require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function fixVariants() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // We want to find cases where a product name ends with - 2.4, - 2.6, - 2.8, - 2.10
    console.log("Fetching potential standalone variants...");
    const { data: products, error } = await supabase
        .from('master_product')
        .select('*')
        .ilike('name', '%Bangle%');
        
    if (error) {
         console.error(error); return;
    }
        
    console.log(`Initial fetch: ${products.length} Bangle products`);
    
    // Grouping logic based on exact name match after stripping the " - X.X" suffix
    const grouped = {};
    for (const p of products) {
        // Find suffix like " - 2.8" or " - 2.10" or " - 2.6"
        const match = p.name.match(/(.+) - \d\.\d+$/);
        if (match) {
            const baseName = match[1].trim();
            if (!grouped[baseName]) grouped[baseName] = [];
            grouped[baseName].push(p);
        } else {
            // Check if it's already a base name
            if (!grouped[p.name.trim()]) grouped[p.name.trim()] = [];
            grouped[p.name.trim()].push(p);
        }
    }
    
    let mergedCount = 0;
    let deletedCount = 0;
    
    // Process groups with more than 1 item
    for (const [baseName, items] of Object.entries(grouped)) {
        if (items.length > 1) {
            console.log(`\nFound group: "${baseName}" with ${items.length} items`);
            
            // The shortest SKU or the first item is the parent
            items.sort((a, b) => a.product_id - b.product_id);
            const parent = items[0];
            const children = items.slice(1);
            
            // 1. Rename parent to baseName
            if (parent.name !== baseName) {
                console.log(`  Updating parent [${parent.product_id}] name from "${parent.name}" to "${baseName}"`);
                await supabase.from('master_product').update({ name: baseName }).eq('product_id', parent.product_id);
            }
            
            // 2. Move variants from children to parent
            for (const child of children) {
                console.log(`  Moving variants from child [${child.product_id}] "${child.name}" to parent [${parent.product_id}]`);
                // Get variants of child
                const { data: cVars } = await supabase.from('product_variants').select('*').eq('product_id', child.product_id);
                
                if (cVars && cVars.length > 0) {
                    for (const v of cVars) {
                        // Update variant to point to parent
                        await supabase.from('product_variants').update({ product_id: parent.product_id }).eq('variant_id', v.variant_id);
                        console.log(`    Moved variant [${v.variant_id}] ${v.variant_name} -> now linked to product ${parent.product_id}`);
                    }
                }
                
                // Also update order items just in case (optional, but let's skip for safety unless needed)
                
                // Instead of deleting (which might break foreign keys in order_items), 
                // we'll just set it to inactive and append (Merged) to its name so it's hidden
                console.log(`  Deactivating child [${child.product_id}] "${child.name}"`);
                await supabase.from('master_product').update({ 
                    is_Active: false, 
                    name: child.name + ' (Merged)' 
                }).eq('product_id', child.product_id);
                
                deletedCount++;
            }
            mergedCount++;
        }
    }
    
    console.log(`\nFix completed! Merged ${mergedCount} groups, deactivated ${deletedCount} duplicate parent products.`);
}

fixVariants();
