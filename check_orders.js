const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gvsorguincvinuiqtooo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c29yZ3VpbmN2aW51aXF0b29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY0ODgxOSwiZXhwIjoyMDY4MjI0ODE5fQ.9fuH7ZPslf9S875L2Q7YZxbvKoScQ-KTgIFQMOdOo9w';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('order_id, order_status, payment_status, created_at, updated_at, transaction_id, payment_transaction_id, order_note')
        .in('order_id', ['WB666609', 'WB228380', 'WB825449']);

    if (error) {
        console.error('Error fetching orders:', error);
    } else {
        console.log('Orders Details:', JSON.stringify(orders, null, 2));
    }
}

checkOrders();
