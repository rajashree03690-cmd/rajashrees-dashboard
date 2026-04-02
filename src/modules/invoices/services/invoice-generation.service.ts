import { supabase } from '@/lib/supabase';

import type { InvoiceGenerationResult, BulkInvoiceResult } from '@/types/invoices';

/**
 * Invoice Generation Service
 * Handles order-based invoice generation following Shopify/WooCommerce pattern
 */
export const invoiceGenerationService = {
    /**
     * Validate if order can have invoice generated
     */
    canGenerateInvoice(order: any): { valid: boolean; reason?: string } {
        // Check if already invoiced
        if (order.invoice_number) {
            return { valid: false, reason: 'Invoice already generated' };
        }

        // Check if locked
        if (order.is_locked) {
            return { valid: false, reason: 'Order is locked' };
        }

        // Check order status
        const validStatuses = ['approved', 'completed', 'processing'];
        if (!validStatuses.includes(order.order_status?.toLowerCase())) {
            return { valid: false, reason: `Order must be approved or completed (current: ${order.order_status})` };
        }

        return { valid: true };
    },

    /**
     * Generate invoice for single order
     */
    async generateInvoice(orderId: string): Promise<InvoiceGenerationResult> {
        try {
            // Validate first (fetch simplified order for validation)
            const { data: order, error: fetchError } = await supabase
                .from('orders')
                .select('order_id, invoice_number, is_locked, order_status')
                .eq('order_id', orderId)
                .single();

            if (fetchError || !order) {
                return {
                    success: false,
                    order_id: orderId,
                    error: 'Order not found'
                };
            }

            // Validate
            const validation = this.canGenerateInvoice(order);
            if (!validation.valid) {
                return {
                    success: false,
                    order_id: orderId,
                    error: validation.reason
                };
            }

            // Call Secure Backend API (Bypassing RLS)
            console.log('Using Secure API for Invoice Generation...');
            const response = await fetch('/api/admin/invoices/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ order_id: orderId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate invoice via API');
            }


            const result = await response.json();
            const validInvoiceUrl = result.invoice_url;

            console.log(`✅ Invoice generated successfully: ${validInvoiceUrl}`);

            return {
                success: true,
                order_id: orderId,
                invoice_number: orderId
            };
        } catch (error: any) {
            console.error('Error generating invoice:', error);

            return {
                success: false,
                order_id: orderId,
                error: error.message || 'Failed to generate invoice'
            };
        }
    },

    /**
     * Generate invoices for multiple orders (bulk operation)
     */
    /**
     * Generate invoices for multiple orders (using secure bulk API)
     */
    async generateBulkInvoices(orderIds: string[]): Promise<BulkInvoiceResult> {
        try {
            console.log(`Starting bulk generation for ${orderIds.length} orders...`);

            const response = await fetch('/api/admin/invoices/bulk-generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_ids: orderIds })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Bulk generation failed');
            }

            const data = await response.json();
            return {
                total: orderIds.length,
                successful: data.successful,
                failed: data.failed,
                results: data.results
            };

        } catch (error) {
            console.error('Bulk generation error:', error);
            // Fallback object to match type
            return {
                total: orderIds.length,
                successful: 0,
                failed: orderIds.length,
                results: []
            };
        }
    },

    /**
     * Download invoices as Merged PDF
     */
    async downloadInvoicesPdf(params: { orderIds?: string[], dateFrom?: Date, dateTo?: Date }) {
        try {
            const body: any = {};
            if (params.orderIds && params.orderIds.length > 0) body.order_ids = params.orderIds;
            if (params.dateFrom) body.date_from = params.dateFrom.toISOString();
            if (params.dateTo) body.date_to = params.dateTo.toISOString();

            const response = await fetch('/api/admin/invoices/download-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) throw new Error('Download failed');

            // Handle Blob download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Bulk_Invoices_${new Date().toISOString().split('T')[0]}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            return true;
        } catch (error) {
            console.error('PDF download error:', error);
            return false;
        }
    },
    /**
     * Check if order has invoice
     */
    async hasInvoice(orderId: string): Promise<boolean> {
        const { data } = await supabase
            .from('orders')
            .select('invoice_number')
            .eq('order_id', orderId)
            .single();

        return !!data?.invoice_number;
    }
};
