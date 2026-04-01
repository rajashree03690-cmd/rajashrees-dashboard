import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrderRefundsRealtime } from '@/hooks/useOrdersRealtime';
import { supabase } from '@/lib/supabase';

interface OrderRefund {
    id: number;
    order_id: string;
    razorpay_refund_id: string;
    refund_amount: number;
    refund_status: 'created' | 'processed' | 'failed';
    refund_reason?: string;
    created_at: string;
    updated_at: string;
}

interface RefundTimelineProps {
    orderId: string;
}

export function RefundTimeline({ orderId }: RefundTimelineProps) {
    const [refunds, setRefunds] = useState<OrderRefund[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRefunds = async () => {
            const { data, error } = await supabase
                .from('order_refunds')
                .select('*')
                .eq('order_id', orderId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setRefunds(data);
            }
            setLoading(false);
        };

        fetchRefunds();
    }, [orderId]);

    useOrderRefundsRealtime({
        orderId,
        onInsert: (newRefund) => {
            setRefunds((prev) => [newRefund, ...prev]);
        },
        onUpdate: (updatedRefund) => {
            setRefunds((prev) =>
                prev.map((refund) =>
                    refund.razorpay_refund_id === updatedRefund.razorpay_refund_id
                        ? updatedRefund
                        : refund
                )
            );
        },
    });

    if (loading) {
        return <div className="text-sm text-gray-500">Loading refunds...</div>;
    }

    if (refunds.length === 0) {
        return <div className="text-sm text-gray-500">No refunds for this order.</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Refund Timeline</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {refunds.map((refund) => (
                        <div
                            key={refund.id}
                            className="flex items-start gap-4 border-l-2 border-gray-200 pl-4 pb-4"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold">₹{refund.refund_amount.toFixed(2)}</span>
                                    <RefundStatusBadge status={refund.refund_status} />
                                </div>
                                {refund.refund_reason && (
                                    <p className="text-sm text-gray-600 mb-1">{refund.refund_reason}</p>
                                )}
                                <p className="text-xs text-gray-500">
                                    {new Date(refund.created_at).toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-400 font-mono">
                                    {refund.razorpay_refund_id}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function RefundStatusBadge({ status }: { status: 'created' | 'processed' | 'failed' }) {
    const variants: Record<typeof status, { label: string; className: string }> = {
        created: {
            label: 'Processing',
            className: 'bg-yellow-100 text-yellow-800',
        },
        processed: {
            label: 'Completed',
            className: 'bg-green-100 text-green-800',
        },
        failed: {
            label: 'Failed',
            className: 'bg-red-100 text-red-800',
        },
    };

    const config = variants[status];

    return <Badge className={config.className}>{config.label}</Badge>;
}
