'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { invoiceGenerationService } from '../services/invoice-generation.service';
import { ordersService } from '@/modules/orders/services/orders.service';
import type { BulkInvoiceResult } from '@/types/invoices';
import { FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface GenerateInvoiceDialogProps {
    open: boolean;
    onClose: () => void;
    orderIds: string[];
    onSuccess: () => void;
}

export default function GenerateInvoiceDialog({
    open,
    onClose,
    orderIds,
    onSuccess
}: GenerateInvoiceDialogProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<BulkInvoiceResult | null>(null);

    async function handleGenerate() {
        setLoading(true);
        try {
            const bulkResult = await invoiceGenerationService.generateBulkInvoices(orderIds);
            setResult(bulkResult);

            if (bulkResult.successful > 0) {
                // Send invoice_generated emails in background
                bulkResult.results
                    .filter((r: any) => r.success && r.order_id)
                    .forEach((r: any) => {
                        ordersService.sendOrderNotification('invoice_generated', r.order_id).catch(console.error);
                    });
                onSuccess();
            }
        } catch (error) {
            console.error('Error generating invoices:', error);
            alert('Failed to generate invoices');
        } finally {
            setLoading(false);
        }
    }

    function handleClose() {
        setResult(null);
        onClose();
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md" aria-describedby="generate-invoice-desc">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        Generate Invoices
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Dialog for generating invoices for selected orders.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {!result ? (
                        <>
                            <p className="text-sm text-gray-600">
                                You are about to generate invoices for <strong>{orderIds.length}</strong> order(s).
                            </p>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <p className="text-sm text-yellow-800">
                                    ⚠️ <strong>Warning:</strong> Once generated, orders will be locked and cannot be edited.
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-medium">Generation Complete</span>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Total Orders:</span>
                                    <span className="font-medium">{result.total}</span>
                                </div>
                                <div className="flex justify-between text-green-600">
                                    <span className="text-sm">Successful:</span>
                                    <span className="font-medium">{result.successful}</span>
                                </div>
                                {result.failed > 0 && (
                                    <div className="flex justify-between text-red-600">
                                        <span className="text-sm">Failed:</span>
                                        <span className="font-medium">{result.failed}</span>
                                    </div>
                                )}
                            </div>

                            {result.failed > 0 && (
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    <p className="text-sm font-medium text-gray-700">Failed Orders:</p>
                                    {result.results.filter((r: any) => !r.success).map((r: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2 text-sm">
                                            <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                            <span className="text-gray-600">
                                                Order #{r.order_id}: {r.error}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {!result ? (
                        <>
                            <Button variant="outline" onClick={handleClose} disabled={loading}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {loading ? 'Generating...' : 'Generate Invoices'}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={handleClose}>
                            Close
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
