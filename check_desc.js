const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://gvsorguincvinuiqtooo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c29yZ3VpbmN2aW51aXF0b29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY0ODgxOSwiZXhwIjoyMDY4MjI0ODE5fQ.9fuH7ZPslf9S875L2Q7YZxbvKoScQ-KTgIFQMOdOo9w'
);

async function checkDescription() {
    const { data, error } = await supabase
        .from('master_product')
        .select('product_id, description')
        .limit(200);

    if (error) {
        console.error(error);
        return;
    }

    let maxLen = 0;
    let maxId = 0;
    
    for (const p of data) {
        if (p.description) {
            if (p.description.length > maxLen) {
                maxLen = p.description.length;
                maxId = p.product_id;
            }
        }
    }
    
    console.log(`Max description length is ${maxLen} characters (Product ID: ${maxId})`);
    
    if (maxLen > 1000000) {
        console.log(`That's ${(maxLen / 1024 / 1024).toFixed(2)} MB of text per product!`);
    } else if (maxLen > 1000) {
        console.log(`That's ${(maxLen / 1024).toFixed(2)} KB of text per product.`);
    }
}

checkDescription();
