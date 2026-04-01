require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.time("Count Query");
    const { count, error } = await supabase
        .from('master_product')
        .select('*', { count: 'exact', head: true })
        .eq('is_Active', true);
    console.timeEnd("Count Query");

    console.log("Count:", count, "Error:", error);
}
test();
