
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testEdgeFunctions() {
    console.log('Testing Edge Functions...');
    const start = Date.now();

    try {
        console.log('1. Calling getOrderWithItems...');
        const res1 = await fetch(`${SUPABASE_URL}/functions/v1/getOrderWithItems?limit=1`, {
            headers: { 'Authorization': `Bearer ${ANON_KEY}` }
        });
        console.log(`- Status: ${res1.status}`);
        if (res1.ok) {
            const json1 = await res1.json();
            console.log(`- Success! Total Orders: ${json1.total || json1.orders?.length}`);
        } else {
            console.error(`- Failed: ${res1.statusText}`);
            const text = await res1.text();
            console.error(text);
        }
    } catch (e) {
        console.error('- Error calling getOrderWithItems:', e.message);
    }

    console.log(`Time taken: ${(Date.now() - start)}ms`);
}

testEdgeFunctions();
