import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';

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

const COMPANY_DETAILS = {
    name: "Rajashree Fashion",
    address: "Chennai 600116, Tamil Nadu",
    gstin: "33GFWPS8459J1Z8",
    phone: "7010041418"
};

export async function generateInvoiceCore(order_id: string): Promise<{ success: boolean; invoice_url?: string; error?: string }> {
    try {
        console.log(`[Invoice Generator] Processing Order ID: ${order_id}`);

        // 1. Fetch Order Data
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .select(`
                *,
                customers (
                    full_name, email, mobile_number, address, state, city, pincode
                ),
                order_items (
                    quantity,
                    catalogue_product_id,
                    product_variants (
                        variant_name,
                        sku,
                        saleprice,
                        regularprice,
                       product_id,
                        master_product (name)
                    )
                )
            `)
            .eq('order_id', order_id)
            .single();

        if (orderError || !order) {
            throw new Error(`Order not found: ${orderError?.message}`);
        }

        // 2. Prepare Data
        const customer = order.customers || {};
        const isTamilNadu = (order.shipping_state || customer.state || '').trim().toLowerCase() === 'tamil nadu';

        if (!order.order_items || order.order_items.length === 0) {
            // Warn but proceed? Or fail. Invoice for 0 items?
            // Let's allow it but log.
            console.warn(`[Invoice Generator] Order ${order_id} has no items.`);
        }

        const items = (order.order_items || []).map((item: any) => {
            const variant = item.product_variants || {};
            const master = variant.master_product || {};
            const productName = master.name
                ? `${master.name} - ${variant.variant_name || ''}`
                : (variant.variant_name || 'Item');

            // Priority: Price at Add -> Sale Price -> Regular Price -> 0
            const unitPrice = Number(item.price || variant.saleprice || variant.regularprice || 0);
            const quantity = Number(item.quantity || 1);
            const total = unitPrice * quantity;

            // Simple Tax Logic (3% GST)
            const taxRate = 3.0;
            const baseAmount = total / (1 + taxRate / 100);
            const taxAmount = total - baseAmount;

            return {
                description: `${productName}\nSKU: ${variant.sku || '-'}`,
                quantity,
                unitPrice,
                total,
                baseAmount,
                taxAmount
            };
        });

        const subtotal = items.reduce((sum: number, item: any) => sum + item.baseAmount, 0);
        const totalTax = items.reduce((sum: number, item: any) => sum + item.taxAmount, 0);
        const shipping = Number(order.shipping_amount || 0);
        // If total_amount exists in DB, use it, otherwise calc.
        // Actually, best to recalculate to match line items + shipping to ensure PDF matches.
        const grandTotal = items.reduce((sum: number, item: any) => sum + item.total, 0) + shipping;

        // 3. Generate PDF
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let y = height - 50;

        // --- ADD LOGO ---
        try {
            const fs = await import('fs');
            const path = await import('path');
            const logoPath = path.join(process.cwd(), 'public', 'logo-peacock.png');

            if (fs.existsSync(logoPath)) {
                const logoImageBytes = fs.readFileSync(logoPath);
                // Try PNG first, if fails (due to jpg extension mismatch) we'd need logic, but file is .png
                const logoImage = await pdfDoc.embedPng(logoImageBytes);
                const logoDims = logoImage.scale(0.15); // Adjust scale as needed

                page.drawImage(logoImage, {
                    x: 50,
                    y: y - logoDims.height + 10, // Align top roughly
                    width: logoDims.width,
                    height: logoDims.height,
                });
                // No X-shift for text needed if logo is above or small? 
                // Let's put logo on LEFT, and text on Right or Below?
                // Standard: Logo Top-Left. 
                y -= (logoDims.height + 10);
            } else {
                console.warn(`[Invoice Generator] Logo not found at ${logoPath}`);
                page.drawText('INVOICE', { x: 50, y, size: 20, font: fontBold });
                y -= 25;
            }
        } catch (logoErr) {
            console.error('[Invoice Generator] Logo embed error:', logoErr);
            // Fallback header
            page.drawText('INVOICE', { x: 50, y, size: 20, font: fontBold });
            y -= 25;
        }

        // Header Text (Company)
        page.drawText(COMPANY_DETAILS.name, { x: 50, y, size: 12, font: fontBold });
        page.drawText(COMPANY_DETAILS.address, { x: 50, y: y - 15, size: 10, font });
        page.drawText(`GSTIN: ${COMPANY_DETAILS.gstin}`, { x: 50, y: y - 30, size: 10, font });
        page.drawText(`Phone: ${COMPANY_DETAILS.phone}`, { x: 50, y: y - 45, size: 10, font });

        // Invoice Details
        const invoiceNum = order.invoice_number || order.order_id;
        const invoiceDate = new Date().toLocaleDateString();
        page.drawText(`Invoice #: ${invoiceNum}`, { x: width - 200, y: height - 50, size: 10, font: fontBold });
        page.drawText(`Date: ${invoiceDate}`, { x: width - 200, y: height - 65, size: 10, font });
        page.drawText(`Order ID: ${order.order_id}`, { x: width - 200, y: height - 80, size: 10, font });

        y -= 80;

        // Bill To
        page.drawText('Bill To:', { x: 50, y, size: 10, font: fontBold });
        y -= 15;
        page.drawText(customer.full_name || order.name || 'Guest', { x: 50, y, size: 10, font });
        y -= 15;
        const addressLines = (order.shipping_address || customer.address || '').split('\n');
        addressLines.forEach((line: string) => {
            page.drawText(line.substring(0, 40), { x: 50, y, size: 10, font });
            y -= 12;
        });
        page.drawText(`Phone: ${customer.mobile_number || order.contact_number || ''}`, { x: 50, y, size: 10, font });

        y -= 30;

        // Table
        const startY = y;
        page.drawLine({ start: { x: 50, y: startY + 5 }, end: { x: width - 50, y: startY + 5 }, thickness: 1 });
        page.drawText('Item', { x: 50, y, size: 10, font: fontBold });
        page.drawText('Qty', { x: 300, y, size: 10, font: fontBold });
        page.drawText('Price', { x: 350, y, size: 10, font: fontBold });
        page.drawText('Tax', { x: 420, y, size: 10, font: fontBold });
        page.drawText('Total', { x: 500, y, size: 10, font: fontBold });
        page.drawLine({ start: { x: 50, y: startY - 5 }, end: { x: width - 50, y: startY - 5 }, thickness: 1 });
        y -= 20;

        for (const item of items) {
            if (y < 50) { page = pdfDoc.addPage(); y = height - 50; }
            page.drawText(item.description, { x: 50, y, size: 9, font, lineHeight: 11 });
            page.drawText(item.quantity.toString(), { x: 300, y, size: 10, font });
            page.drawText(item.unitPrice.toFixed(2), { x: 350, y, size: 10, font });
            page.drawText(item.taxAmount.toFixed(2), { x: 420, y, size: 10, font });
            page.drawText(item.total.toFixed(2), { x: 500, y, size: 10, font });
            y -= 25;
        }

        page.drawLine({ start: { x: 50, y: y + 10 }, end: { x: width - 50, y: y + 10 }, thickness: 1 });
        y -= 20;

        // Totals
        const drawTotalLine = (label: string, value: string, isBold = false) => {
            page.drawText(label, { x: 350, y, size: 10, font: isBold ? fontBold : font });
            page.drawText(value, { x: 500, y, size: 10, font: isBold ? fontBold : font });
            y -= 15;
        };

        drawTotalLine('Subtotal:', subtotal.toFixed(2));
        if (isTamilNadu) {
            drawTotalLine('CGST (1.5%):', (totalTax / 2).toFixed(2));
            drawTotalLine('SGST (1.5%):', (totalTax / 2).toFixed(2));
        } else {
            drawTotalLine('IGST (3%):', totalTax.toFixed(2));
        }
        drawTotalLine('Shipping:', shipping.toFixed(2));
        y -= 5;
        drawTotalLine('Grand Total:', grandTotal.toFixed(2), true);

        // 4. Save & Upload
        const pdfBytes = await pdfDoc.save();
        const fileName = `${order_id}_${Date.now()}.pdf`;

        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('invoices')
            .upload(fileName, pdfBytes, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('invoices')
            .getPublicUrl(fileName);

        // 5. Update DB
        const { error: dbUpdateError } = await supabaseAdmin
            .from('orders')
            .update({
                invoice_url: publicUrl,
                is_locked: true,
                invoice_number: invoiceNum,
                invoice_generated_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('order_id', order_id);

        if (dbUpdateError) throw new Error(`DB Update failed: ${dbUpdateError.message}`);

        return { success: true, invoice_url: publicUrl };

    } catch (error: any) {
        console.error(`[Invoice Generator] Error for ${order_id}:`, error);
        return { success: false, error: error.message };
    }
}
