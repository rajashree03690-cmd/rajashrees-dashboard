const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function debugShipments() {
    console.log('🔍 Debugging Shipments Source Column...\n');

    // 1. Check if source column exists
    console.log('--- 1. Checking if source column exists ---');
    const { data: columns, error: colError } = await supabase
        .from('shipment_tracking')
        .select('order_id, source, shipping_status')
        .limit(5);

    if (colError) {
        console.error('❌ Error:', colError.message);
        return;
    }

    console.log('✅ Source column exists! Sample data:');
    console.table(columns);

    // 2. Count shipments by source
    console.log('\n--- 2. Counting shipments by source ---');
    const { data: all } = await supabase
        .from('shipment_tracking')
        .select('source');

    const counts = all?.reduce((acc, item) => {
        const source = item.source || 'NULL';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    }, {});

    console.log('Source distribution:');
    console.table(counts);

    // 3. Check if there are ANY web orders in orders table
    console.log('\n--- 3. Checking web orders in orders table ---');
    const { data: webOrders, error: webErr } = await supabase
        .from('orders')
        .select('order_id, source')
        .eq('source', 'WEB')
        .limit(5);

    if (webErr) {
        console.error('❌ Error:', webErr.message);
    } else {
        console.log(`Found ${webOrders?.length || 0} WEB orders in orders table`);
        if (webOrders && webOrders.length > 0) {
            console.log('Sample web order IDs:', webOrders.map(o => o.order_id));

            // 4. Check if those web orders have shipments
            console.log('\n--- 4. Checking if web orders have shipments ---');
            const webOrderIds = webOrders.map(o => o.order_id);
            const { data: webShipments } = await supabase
                .from('shipment_tracking')
                .select('order_id, source')
                .in('order_id', webOrderIds);

            console.log(`Shipments for those web orders: ${webShipments?.length || 0}`);
            if (webShipments && webShipments.length > 0) {
                console.table(webShipments);
            } else {
                console.warn('⚠️ WEB orders exist but have NO shipments!');
                console.log('This means web orders haven\'t been shipped yet.');
            }
        }
    }

    // 5. Check distinct source values in orders
    console.log('\n--- 5. Distinct source values in orders table ---');
    const { data: distinctSources } = await supabase
        .from('orders')
        .select('source');

    const uniqueSources = [...new Set(distinctSources?.map(o => o.source))];
    console.log('Unique sources:', uniqueSources);
}

debugShipments();
