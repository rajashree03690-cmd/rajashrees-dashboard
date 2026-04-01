import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

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

        console.log(`[Invoice PDF] Request params: order_ids=${order_ids?.length}, date_from=${date_from}, date_to=${date_to}`);

        // 1. Fetch Orders to download
        if (order_ids && order_ids.length > 0) {
            const { data, error } = await supabaseAdmin
                .from('orders')
                .select('order_id, invoice_url, invoice_number')
                .in('order_id', order_ids)
                .not('invoice_url', 'is', null);

            if (error) {
                console.error('[Invoice PDF] DB Error:', error);
                throw error;
            }
            console.log(`[Invoice PDF] DB Query returned ${data?.length} rows for ${order_ids.length} IDs.`);
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

        console.log(`[Invoice PDF] Merging ${ordersToProcess.length} invoices...`);

        // 2. Create Merged PDF
        const mergedPdf = await PDFDocument.create();
        const errors: string[] = [];

        // 3. Process sequentially to maintain order and avoid memory spikes
        for (const order of ordersToProcess) {
            try {
                if (!order.invoice_url) {
                    errors.push(`Order ${order.order_id}: No invoice_url found.`);
                    continue;
                }

                // Extract filename from URL (assumes standard Supabase Storage URL structure)
                const urlParts = order.invoice_url.split('/');
                const fileName = urlParts[urlParts.length - 1];

                if (!fileName) {
                    errors.push(`Order ${order.order_id}: Invalid invoice URL.`);
                    continue;
                }

                // Download directly from Storage (more reliable than HTTP fetch, works for private buckets too)
                const { data: fileBlob, error: downloadError } = await supabaseAdmin
                    .storage
                    .from('invoices')
                    .download(fileName);

                if (downloadError || !fileBlob) {
                    console.warn(`Failed to download invoice for ${order.order_id}:`, downloadError);
                    errors.push(`Order ${order.order_id}: Storage download failed.`);
                    continue;
                }

                const arrayBuffer = await fileBlob.arrayBuffer();
                const donorPdfDoc = await PDFDocument.load(arrayBuffer);

                // Copy all pages
                const copiedPages = await mergedPdf.copyPages(donorPdfDoc, donorPdfDoc.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));

            } catch (err: any) {
                console.error(`Error processing ${order.order_id}:`, err);
                errors.push(`Order ${order.order_id}: ${err.message}`);
            }
        }

        // If no pages were added (all failed), return error
        if (mergedPdf.getPageCount() === 0) {
            return NextResponse.json({
                error: 'Failed to merge any invoices.',
                details: errors
            }, { status: 500 });
        }

        // 4. Save and Return PDF
        const pdfBytes = await mergedPdf.save();
        const buffer = Buffer.from(pdfBytes);

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Bulk_Invoices_${new Date().toISOString().split('T')[0]}.pdf`,
                'X-Error-Count': errors.length.toString()
            }
        });

    } catch (error: any) {
        console.error('[Invoice PDF API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
