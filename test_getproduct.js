require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testGetProduct(sku) {
    console.log(`\n=== Testing SKU: "${sku}" ===`);
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/getproductforwhatsapp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ANON_KEY}`,
            },
            body: JSON.stringify({ sku }),
        });

        console.log(`Status: ${res.status}`);
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            console.log('Response:', JSON.stringify(json, null, 2).substring(0, 500));
        } catch {
            console.log('Raw response:', text.substring(0, 500));
        }
    } catch (err) {
        console.error('Fetch error:', err.message);
    }
}

async function run() {
    // Test codes from the WhatsApp screenshot
    await testGetProduct('9111');
    await testGetProduct('CMB9111');
    await testGetProduct('RFP-CMB9111');
    await testGetProduct('9113');
    await testGetProduct('MAT9096');
    await testGetProduct('5139');
}

run();
