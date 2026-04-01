export interface InvoiceData {
    order_id: string;
    invoice_number: string | null;
    invoice_date: string;
    invoice_url?: string | null;
    customer: {
        name: string;
        email?: string;
        phone?: string;
        billing_address?: string;
        shipping_address?: string;
        gstin?: string;
    };
    items: InvoiceItem[];
    subtotal: number;
    tax_amount: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    shipping_charges: number;
    total: number;
    sales_channel: string;
}

export interface InvoiceItem {
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    tax_amount: number;
    total: number;
}

export interface InvoiceGenerationResult {
    success: boolean;
    order_id: string;
    invoice_number?: string;
    error?: string;
}

export interface BulkInvoiceResult {
    total: number;
    successful: number;
    failed: number;
    results: InvoiceGenerationResult[];
}
