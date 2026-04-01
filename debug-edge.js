
const fs = require('fs');
const path = require('path');
const https = require('https');

// Simple env parser
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const ANON_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generateinvoice?order_id=WA003868`;

console.log('Testing Edge Function:', FUNCTION_URL);

// Test GET
const options = {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
    }
};

const req = https.request(FUNCTION_URL, options, (res) => {
    console.log('\n--- GET Request ---');
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);

    res.on('data', (d) => process.stdout.write(d));
});

req.on('error', (e) => {
    console.error('OPTIONS Error:', e);
});
req.end();

// Test POST
const postOptions = {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json'
    }
};

const postData = JSON.stringify({
    order_id: 'TEST-123',
    items: [{ product_name: 'Test Item', quantity: 1, price: 100 }]
});

const postReq = https.request(FUNCTION_URL, postOptions, (res) => {
    console.log('\n--- POST Request ---');
    console.log('Status:', res.statusCode);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Body:', data.substring(0, 500)); // Log first 500 chars
    });
});

postReq.on('error', (e) => console.error('POST Error:', e));
postReq.write(postData);
postReq.end();
