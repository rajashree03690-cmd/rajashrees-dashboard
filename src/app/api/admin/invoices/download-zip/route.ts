import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';

// Initialize Supabase Admin client
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { order_ids, date_from, date_to } = body;

        let ordersToProcess = [];

        // 1. Fetch Orders to download
        if (order_ids && order_ids.length > 0) {
            const { data, error } = await supabaseAdmin
                .from('orders')
                .select('order_id, invoice_url, invoice_number')
                .in('order_id', order_ids)
                .not('invoice_url', 'is', null);

            if (error) throw error;
            ordersToProcess = data || [];
        } else if (date_from && date_to) {
            const { data, error } = await supabaseAdmin
                .from('orders')
                .select('order_id, invoice_url, invoice_number')
                .gte('created_at', date_from)
                .lte('created_at', date_to)
                .not('invoice_url', 'is', null);

            if (error) throw error;
            ordersToProcess = data || [];
        } else {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        if (ordersToProcess.length === 0) {
            return NextResponse.json({ error: 'No invoices found for criteria' }, { status: 404 });
        }

        console.log(`[Invoice Zip] Processing ${ordersToProcess.length} invoices...`);

        // 2. Create Zip
        const zip = new AdmZip();

        // 3. Download Files from Storage
        const downloadFile = async (order: any) => {
            try {
                if (!order.invoice_url) {
                    errors.push(`Order ${order.order_id}: No invoice_url found in database.`);
                    return;
                }

                const response = await fetch(order.invoice_url);
                if (!response.ok) {
                    console.warn(`Failed to download invoice for ${order.order_id}: ${response.statusText}`);
                    errors.push(`Order ${order.order_id}: Failed to download PDF (Status: ${response.status}) - ${order.invoice_url}`);
                    return;
                }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const fileName = `Invoice_${order.invoice_number || order.order_id}.pdf`;

                zip.addFile(fileName, buffer);
            } catch (err: any) {
                console.error(`Error adding ${order.order_id} to zip:`, err);
                errors.push(`Order ${order.order_id}: Internal Error - ${err.message}`);
            }
        };

        const errors: string[] = [];

        // Process in parallel (batches of 10)
        const BATCH_SIZE = 10;
        for (let i = 0; i < ordersToProcess.length; i += BATCH_SIZE) {
            const batch = ordersToProcess.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(o => downloadFile(o)));
        }

        // Add error log to zip if any errors occurred
        if (errors.length > 0) {
            const errorContent = `The following invoices could not be downloaded:\n\n${errors.join('\n')}\n\nPossible reasons:\n1. The invoice PDF was deleted from storage.\n2. The link in the database is broken.\n3. Network issues during download.`;
            zip.addFile("_ERRORS.txt", Buffer.from(errorContent, "utf-8"));
        }

        // 4. Return Zip
        const zipBuffer = zip.toBuffer();

        return new NextResponse(zipBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename=Invoices_${new Date().toISOString().split('T')[0]}.zip`
            }
        });

    } catch (error: any) {
        console.error('[Invoice Zip API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
