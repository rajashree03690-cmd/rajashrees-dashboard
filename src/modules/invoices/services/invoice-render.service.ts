import { supabase } from '@/lib/supabase';
import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';
import type { InvoiceData, InvoiceItem } from '@/types/invoices';

/**
 * Invoice Rendering Service
 * Fetches order data and prepares it for invoice display/PDF generation
 */
export const invoiceRenderService = {
    /**
     * Fetch and prepare invoice data from order
     */
    async getInvoiceData(orderId: string): Promise<InvoiceData | null> {
        try {
            // 1. Fetch data from Edge Function for consistency
            const [edgeResponse, dbResponse] = await Promise.all([
                fetch(
                    `${getSupabaseBaseUrl()}/functions/v1/generateinvoice?order_id=${orderId}`,
                    {
                        headers: { 'Authorization': `Bearer ${getSupabaseAnonKey()}` }
                    }
                ),
                // 2. ALSO fetch invoice_url directly from DB (since Edge Function might not return it)
                supabase
                    .from('orders')
                    .select('invoice_url')
                    .eq('order_id', orderId)
                    .single()
            ]);

            if (!edgeResponse.ok) {
                console.error('Failed to fetch invoice data from Edge Function');
                return null;
            }

            const data = await edgeResponse.json();
            const invoiceUrl = dbResponse.data?.invoice_url || null;

            // Helper to format address with line breaks
            const formatAddress = (addr: string) => {
                if (!addr) return '';
                return addr
                    .replace(/\\n/g, '\n')       // Standard \n
                    .replace(/\\\s+n/g, '\n')    // \ n (backslash space n)
                    .replace(/\\\\n/g, '\n')     // Double escaped \\n
                    .replace(/,\s*/g, '\n')      // Comma to newline (optional, but often good for address blocks)
                    .replace(/\s*\n\s*/g, '\n')  // Clean up spaces around newlines
                    .trim();
            };

            // Calculate GST
            const isTamilNadu = data.shipping_state?.trim().toLowerCase() === 'tamil nadu';
            const totalGstRate = 3.0;

            let subtotal = 0;
            let totalTax = 0;

            const items: InvoiceItem[] = (data.items || []).map((item: any) => {
                const quantity = item.quantity || 1;
                const priceIncl = item.price || 0;
                const lineTotalIncl = priceIncl * quantity;

                const baseAmount = lineTotalIncl / (1 + totalGstRate / 100);
                const taxForLine = lineTotalIncl - baseAmount;

                subtotal += baseAmount;
                totalTax += taxForLine;

                return {
                    product_name: item.product_name || item.variant_name || 'Item',
                    sku: item.sku || '-',
                    quantity: quantity,
                    unit_price: priceIncl,
                    tax_rate: totalGstRate,
                    tax_amount: taxForLine,
                    total: lineTotalIncl
                };
            });

            // Split GST
            const cgst = isTamilNadu ? (totalTax / 2) : 0;
            const sgst = isTamilNadu ? (totalTax / 2) : 0;

            const shipping = data.shipping_amount || 0;
            const grandTotal = subtotal + totalTax + shipping;

            const invoiceData: InvoiceData = {
                order_id: data.order_id,
                invoice_number: data.order_id,
                invoice_date: data.order_date,
                invoice_url: invoiceUrl, // Use the one fetched from DB
                customer: {
                    name: data.customer_name,
                    email: data.email,
                    phone: data.mobile_number,
                    billing_address: formatAddress(data.shipping_address),
                    shipping_address: formatAddress(data.shipping_address),
                    gstin: ''
                },
                items,
                subtotal: subtotal,
                tax_amount: totalTax,
                cgst: cgst,
                sgst: sgst,
                shipping_charges: shipping,
                total: grandTotal,
                sales_channel: data.source || 'App'
            };

            return invoiceData;
        } catch (error) {
            console.error('Error preparing invoice data:', error);
            return null;
        }
    },

    /**
     * Get invoice HTML (Updated to match PDF details)
     */
    async renderInvoiceHTML(orderId: string): Promise<string | null> {
        const invoiceData = await this.getInvoiceData(orderId);
        if (!invoiceData) return null;

        return `
            <div style="font-family: Arial, sans-serif; padding: 40px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                    <div>
                        <h1>INVOICE</h1>
                        <p><strong>${invoiceData.invoice_number}</strong></p>
                        <p>Date: ${new Date(invoiceData.invoice_date).toLocaleDateString()}</p>
                    </div>
                    <div style="text-align: right;">
                        <h3>Rajashree Fashion</h3>
                        <p>Chennai 600116, Tamil Nadu</p>
                        <p>GSTIN: 33GFWPS8459J1Z8</p>
                        <p>Phone: +919677941418</p>
                    </div>
                </div>
                <hr/>
                <h3>Customer Details</h3>
                <p><strong>${invoiceData.customer.name}</strong></p>
                <p>${invoiceData.customer.phone || ''}</p>
                <p>${invoiceData.customer.billing_address || ''}</p>
                <hr/>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #000;">
                            <th style="text-align: left; padding: 8px;">Product</th>
                            <th style="text-align: right; padding: 8px;">Qty</th>
                            <th style="text-align: right; padding: 8px;">Price</th>
                            <th style="text-align: right; padding: 8px;">Tax</th>
                            <th style="text-align: right; padding: 8px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoiceData.items.map(item => `
                            <tr style="border-bottom: 1px solid #ccc;">
                                <td style="padding: 8px;">${item.product_name}<br/><small>${item.sku}</small></td>
                                <td style="text-align: right; padding: 8px;">${item.quantity}</td>
                                <td style="text-align: right; padding: 8px;">₹${item.unit_price.toFixed(2)}</td>
                                <td style="text-align: right; padding: 8px;">₹${item.tax_amount.toFixed(2)}</td>
                                <td style="text-align: right; padding: 8px;">₹${item.total.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <hr/>
                <div style="text-align: right;">
                    <p>Subtotal: ₹${invoiceData.subtotal.toFixed(2)}</p>
                    <p>CGST (9%): ₹${invoiceData.cgst?.toFixed(2)}</p>
                    <p>SGST (9%): ₹${invoiceData.sgst?.toFixed(2)}</p>
                    <p>Shipping: ₹${invoiceData.shipping_charges.toFixed(2)}</p>
                    <p><strong>Grand Total: ₹${invoiceData.total.toFixed(2)}</strong></p>
                </div>
            </div>
        `;
    }
};
