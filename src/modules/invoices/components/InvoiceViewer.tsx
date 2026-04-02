'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { invoiceGenerationService } from '../services/invoice-generation.service';
import { invoiceRenderService } from '../services/invoice-render.service';
// import { invoicePdfService } from '../services/invoice-pdf.service'; // Removed client-side fallback
import type { InvoiceData } from '@/types/invoices';
import { Download, Loader2, Mail, MessageCircle, FileText } from 'lucide-react';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';

interface InvoiceViewerProps {
    open: boolean;
    onClose: () => void;
    orderId: string;
}

export default function InvoiceViewer({ open, onClose, orderId }: InvoiceViewerProps) {
    const [loading, setLoading] = useState(true);
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

    useEffect(() => {
        if (open && orderId) {
            loadInvoice();
        }
    }, [open, orderId]);

    async function loadInvoice() {
        setLoading(true);
        try {
            const data = await invoiceRenderService.getInvoiceData(orderId);
            setInvoiceData(data);
        } catch (error) {
            console.error('Error loading invoice:', error);
        } finally {
            setLoading(false);
        }
    }

    const [downloading, setDownloading] = useState(false);

    async function handleDownloadPDF() {
        if (!invoiceData) return;

        // Priority 1: Use existing URL from DB
        if (invoiceData.invoice_url) {
            window.open(invoiceData.invoice_url, '_blank');
            return;
        }

        // Priority 2: Generate via Edge Function on-the-fly (No Client Side Fallback)
        setDownloading(true);
        try {
            console.log('Generating PDF via Edge Function...');
            const result = await invoiceGenerationService.generateInvoice(orderId);

            if (result.success && result.invoice_number) { // invoice_number here might be order_id per service logic
                // We need the URL. The service generates it but currently checks database to return simple success object.
                // We might need to re-fetch the invoice data to get the URL, OR rely on the service to return it.
                // Looking at service code, it logs the URL but returns { success, order_id, invoice_number }.
                // We should reload the invoice data to get the new URL.
                await loadInvoice();
                // After reload, invoiceData should have the URL (if state updates fast enough), or we check DB again.
                // Ideally, we just tell the user "Generated" and they click again, or we auto-open logic.
                // For now, let's reload.
            } else {
                alert('Failed to generate PDF: ' + result.error);
            }
        } catch (error: any) {
            console.error('Error generating PDF:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setDownloading(false);
        }
    }

    function handlePrint() {
        window.print();
    }

    if (loading) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <VisuallyHidden.Root>
                        <DialogTitle>Loading Invoice</DialogTitle>
                    </VisuallyHidden.Root>
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    if (!invoiceData) {
        return (
            <Dialog open={open} onOpenChange={onClose}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Error</DialogTitle>
                    </DialogHeader>
                    <p className="text-red-600">Failed to load invoice data</p>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="invoice-content">
                <DialogHeader>
                    <DialogTitle>Invoice: {invoiceData.invoice_number}</DialogTitle>
                </DialogHeader>

                {/* Invoice Preview - Enhanced Design */}
                <div className="border-2 border-gray-300 rounded-lg p-8 bg-white shadow-sm relative overflow-hidden" id="invoice-content">
                    {/* Watermark Logo */}
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '300px',
                            height: '300px',
                            backgroundImage: 'url(/rajashree-logo.png)',
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            opacity: 0.06,
                            pointerEvents: 'none',
                            zIndex: 0,
                        }}
                        aria-hidden="true"
                    />
                    {/* Header: Company Info Left, Logo Right */}
                    <div className="flex justify-between items-start mb-4 pb-4 border-b-2 border-gray-200">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Rajashree Fashion</h1>
                            <div className="text-gray-600 space-y-0.5 mt-2">
                                <p className="text-sm">Chennai 600116, Tamil Nadu</p>
                                <p className="text-sm">Phone: 7010041418 | GSTIN: 33GFWPS8459J1Z8</p>
                            </div>
                        </div>
                        <div>
                            {/* Logo */}
                            <div className="w-24 h-24 relative">
                                <img
                                    src="/rajashree-logo.png"
                                    alt="Rajashree Fashion Logo"
                                    className="object-contain w-full h-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* To Section - Clean Text Format */}
                    <div className="mb-6">
                        <p className="font-semibold text-gray-900 mb-3">To:</p>
                        <div className="ml-6 space-y-1">
                            {/* Customer Name - Larger */}
                            <p className="font-medium text-base text-gray-900">{invoiceData.customer.name}</p>

                            {/* Address Lines */}
                            {invoiceData.customer.billing_address
                                .replace(/\\n/g, '\n')
                                .split('\n')
                                .filter(line => line.trim())
                                .map((line, idx) => (
                                    <p key={idx} className="text-sm text-gray-700">{line.trim()}</p>
                                ))
                            }

                            {/* Contact Details */}
                            <p className="text-sm text-gray-700">Phone: {invoiceData.customer.phone}</p>
                        </div>
                    </div>

                    {/* Order Details & Barcode Row */}
                    <div className="flex justify-between items-end mb-6">
                        <div className="space-y-1">
                            <p>Order Date: {new Date(invoiceData.invoice_date).toISOString().split('T')[0]}</p>
                            <p>Invoice No: {invoiceData.invoice_number}</p>
                        </div>
                        <div className="flex flex-col items-center">
                            {/* Barcode matching Edge Function */}
                            <div className="h-12 w-48 flex justify-center items-end">
                                <img
                                    src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${invoiceData.invoice_number}&scale=2&height=10&includetext=true`}
                                    alt="Invoice Barcode"
                                    className="h-full w-full object-contain"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-6">
                        <table className="w-full">
                            <thead className="bg-gray-200">
                                <tr>
                                    <th className="text-left py-2 px-3 font-semibold text-gray-700 w-1/2">Product</th>
                                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Unit Price</th>
                                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Qty</th>
                                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoiceData.items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-100 text-gray-700">
                                        <td className="py-3 px-3">
                                            <p>{item.product_name}</p>
                                        </td>
                                        <td className="text-right py-3 px-3">Rs.{item.unit_price.toFixed(2)}</td>
                                        <td className="text-right py-3 px-3">{item.quantity}</td>
                                        <td className="text-right py-3 px-3">Rs.{item.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Section */}
                    <div className="flex justify-end mb-8">
                        <div className="w-64 space-y-1 text-gray-800">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>Rs.{invoiceData.subtotal.toFixed(2)}</span>
                            </div>
                            {invoiceData.cgst && invoiceData.cgst > 0 && (
                                <div className="flex justify-between">
                                    <span>CGST (1.5%)</span>
                                    <span>Rs.{invoiceData.cgst.toFixed(2)}</span>
                                </div>
                            )}
                            {invoiceData.sgst && invoiceData.sgst > 0 && (
                                <div className="flex justify-between">
                                    <span>SGST (1.5%)</span>
                                    <span>Rs.{invoiceData.sgst.toFixed(2)}</span>
                                </div>
                            )}
                            {invoiceData.igst && invoiceData.igst > 0 && (
                                <div className="flex justify-between">
                                    <span>IGST (3.0%)</span>
                                    <span>Rs.{invoiceData.igst.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span>Shipping</span>
                                <span>Rs.{invoiceData.shipping_charges.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-base mt-2">
                                <span>Grand Total</span>
                                <span>Rs.{invoiceData.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Disclaimer */}
                    <div className="border-t pt-4">
                        <p className="font-semibold mb-1">Thank you for your purchase!</p>
                        <p className="text-xs text-gray-600">
                            It is mandatory to take a 360 Degree parcel opening video after receiving your product from the courier.
                            Without opening video the product will not be taken back for our consideration.
                        </p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
