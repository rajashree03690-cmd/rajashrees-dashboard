require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gvsorguincvinuiqtooo.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c29yZ3VpbmN2aW51aXF0b29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NDg4MTksImV4cCI6MjA2ODIyNDgxOX0.-KCQAmRJ3OrBbIChgwH7f_mUmhWzaahub7fqRsk0qsk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    console.log('Testing RPC call...');
    const startTime = Date.now();
    
    const { data, error } = await supabase.rpc('get_products_page', {
        p_page: 1,
        p_limit: 20
    });
    
    console.log(`TIME: ${Date.now() - startTime}ms`);
    
    if (error) {
        console.error('ERROR:', error);
    } else {
        console.log('SUCCESS! Data has keys:', Object.keys(data || {}));
        console.log('Items:', data.data?.length);
        console.log('Total:', data.total);
    }
}

test();
