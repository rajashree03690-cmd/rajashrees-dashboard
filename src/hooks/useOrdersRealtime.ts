import { useEffect, useState, useCallback } from 'react';
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

/**
 * Polls for order updates instead of using WebSocket Realtime.
 * WebSocket was causing persistent 500 errors on Vercel deployment
 * because Vercel cannot proxy WebSocket connections.
 * Data loads via direct queries; this hook is now a no-op placeholder
 * that can be re-enabled when WebSocket is properly supported.
 */
export function useOrdersRealtime(_options?: UseOrdersRealtimeOptions) {
    // No-op: Realtime disabled to prevent WebSocket 500 errors on Vercel.
    // Orders are fetched via direct Supabase queries which work perfectly.
    // To re-enable, use Supabase Realtime with a direct (non-proxied) URL.
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

export function useOrderRefundsRealtime(_options?: UseOrderRefundsRealtimeOptions) {
    // No-op: Realtime disabled to prevent WebSocket 500 errors on Vercel.
}

export function useRefundProcessingCount() {
    const [count, setCount] = useState(0);

    const fetchCount = useCallback(async () => {
        try {
            const { count: processingCount, error } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('refund_status', 'processing');

            if (!error && processingCount !== null) {
                setCount(processingCount);
            }
        } catch (err) {
            console.warn('Could not fetch refund count:', err);
        }
    }, []);

    useEffect(() => {
        fetchCount();

        // Poll every 30 seconds instead of WebSocket
        const interval = setInterval(fetchCount, 30000);

        return () => clearInterval(interval);
    }, [fetchCount]);

    return count;
}
