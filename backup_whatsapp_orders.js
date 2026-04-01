require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase.  Using the Service Role Key for elevated permissions.
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function backupWhatsAppOrders() {
    console.log('Fetching live WhatsApp orders from Supabase...\n');

    try {
        // Fetch all orders where source is WhatsApp, including customer details if you need them.
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                order_id,
                created_at,
                total_amount,
                source,
                order_status,
                payment_status,
                payment_method,
                name,
                contact_number,
                customers:customer_id (full_name, mobile_number, email)
            `)
            .eq('source', 'WhatsApp')
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`Found ${orders.length} WhatsApp orders.\n`);

        // Generate a filename with the current timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `whatsapp_orders_backup_${timestamp}.json`;
        const filepath = path.join(__dirname, filename);

        // Analyze missed vs received
        let completedOrPaid = 0;
        let pending = 0;
        let cancelledOrFailed = 0;

        orders.forEach(order => {
            const status = order.order_status?.toUpperCase() || '';
            const paymentStatus = order.payment_status?.toUpperCase() || '';

            if (status === 'COMPLETED' || status === 'PROCESSING' || paymentStatus === 'PAID') {
                completedOrPaid++;
            } else if (status === 'CANCELED' || status === 'FAILED' || paymentStatus === 'FAILED') {
                cancelledOrFailed++;
            } else {
                // Pending, On hold, Awaiting payment etc.
                pending++;
            }
        });

        console.log('--- Summary ---');
        console.log(`Received/Processing/Paid: ${completedOrPaid}`);
        console.log(`Pending/Awaiting Payment: ${pending}`);
        console.log(`Cancelled/Failed        : ${cancelledOrFailed}\n`);

        // Save to file
        fs.writeFileSync(filepath, JSON.stringify(orders, null, 2));
        
        console.log(`Successfully backed up ${orders.length} orders to:`);
        console.log(filepath);

    } catch (err) {
        console.error('Error fetching WhatsApp orders:', err.message);
    }
}

backupWhatsAppOrders();
