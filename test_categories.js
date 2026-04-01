require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function test() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Testing RPC...");
    const rpcRes = await supabase.rpc('get_categories_with_counts');
    console.log("RPC get_categories_with_counts:", rpcRes.data?.length, "error:", rpcRes.error);
    
    console.log("Testing Categories Select...");
    const catRes = await supabase.from('categories').select('*');
    console.log("Categories:", catRes.data?.length, "error:", catRes.error);

    console.log("Testing REST fetch...");
    const fetchRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/categories?select=*`, {
        headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    const fetchJson = await fetchRes.json();
    console.log("Fetch categories length:", fetchJson.length, fetchJson.error || fetchJson.message);
}
test();
