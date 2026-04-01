import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Order {
    order_id: string;
    refund_status?: 'none' | 'partial' | 'processing' | 'refunded' | 'failed';
    refunded_amount?: number;
    [key: string]: any;
}

interface UseOrdersRealtimeOptions {
    onUpdate?: (order: Order) => void;
}

export function useOrdersRealtime(options?: UseOrdersRealtimeOptions) {
    useEffect(() => {
        const channel = supabase
            .channel('orders_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                },
                (payload) => {
                    const updatedOrder = payload.new as Order;
                    options?.onUpdate?.(updatedOrder);
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [options]);
}

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

interface UseOrderRefundsRealtimeOptions {
    orderId?: string;
    onInsert?: (refund: OrderRefund) => void;
    onUpdate?: (refund: OrderRefund) => void;
}

export function useOrderRefundsRealtime(options?: UseOrderRefundsRealtimeOptions) {
    useEffect(() => {
        const channel = supabase
            .channel('order_refunds_realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'order_refunds',
                    filter: options?.orderId ? `order_id=eq.${options.orderId}` : undefined,
                },
                (payload) => {
                    const newRefund = payload.new as OrderRefund;
                    options?.onInsert?.(newRefund);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'order_refunds',
                    filter: options?.orderId ? `order_id=eq.${options.orderId}` : undefined,
                },
                (payload) => {
                    const updatedRefund = payload.new as OrderRefund;
                    options?.onUpdate?.(updatedRefund);
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [options?.orderId]);
}

export function useRefundProcessingCount() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            const { count: processingCount, error } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('refund_status', 'processing');

            if (!error && processingCount !== null) {
                setCount(processingCount);
            }
        };

        fetchCount();

        const channel = supabase
            .channel('refund_processing_count')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                },
                () => {
                    fetchCount();
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, []);

    return count;
}
