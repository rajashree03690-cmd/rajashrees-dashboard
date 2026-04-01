const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkShipments() {
    console.log('🔍 Checking shipments data...\n');

    // Get first 10 shipments
    const { data, error } = await supabase
        .from('shipment_tracking')
        .select('order_id, source, shipping_status, tracking_number')
        .limit(10);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    console.log(`Total shipments fetched: ${data?.length || 0}\n`);

    if (data && data.length > 0) {
        console.log('Sample shipments:');
        data.forEach((s, i) => {
            console.log(`${i + 1}. Order ID: ${s.order_id || 'N/A'}`);
            console.log(`   Source: ${s.source || 'N/A'}`);
            console.log(`   Status: ${s.shipping_status || 'N/A'}`);
            console.log(`   Tracking: ${s.tracking_number || 'N/A'}`);
            console.log('');
        });

        // Check for WEB source
        const webCount = data.filter(s => s.source === 'WEB' || s.source === 'Website').length;
        console.log(`\n📊 Web orders in sample: ${webCount}/${data.length}`);

        // Check order ID patterns
        const orderIdPatterns = data.map(s => s.order_id?.substring(0, 5)).filter(Boolean);
        console.log(`📋 Order ID patterns: ${[...new Set(orderIdPatterns)].join(', ')}`);
    }
}

checkShipments();
