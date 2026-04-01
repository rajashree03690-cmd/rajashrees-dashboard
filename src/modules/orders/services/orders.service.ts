import { supabase } from '@/lib/supabase';
import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';
import type { Order, OrderItem, SkuSummary } from '@/types/orders';

export const ordersService = {
    /**
     * Fetch all orders using Edge Function (MATCHING FLUTTER EXACTLY)
     * Flutter uses: /functions/v1/getOrderWithItems
     * NOTE: Tenant filtering happens via JWT context in Edge Function
     */
    async fetchOrders(search?: string, filter?: string): Promise<{ orders: Order[], total: number }> {
        try {
            console.log('📡 Fetching orders via Direct Supabase Query (Bypassing Edge Function)...');

            // Direct query to ensure we get all columns including invoice_url
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    customers (
                        customer_id,
                        full_name,
                        mobile_number,
                        email
                    )
                `)
                .order('created_at', { ascending: false });

            // Apply basic filtering if params exist (though UI does client-side filtering currently)
            if (search) {
                // Note: Simple search on order_id, logic can be expanded if needed
                query = query.or(`order_id.ilike.%${search}%,invoice_number.ilike.%${search}%`);
            }

            const { data, error } = await query;

            if (error) throw error;

            console.log(`✅ Loaded ${data?.length || 0} orders via Direct Query`);

            const mappedOrders = (data || []).map(order => ({
                ...order,
                // Ensure dates are strings as expected by UI
                order_date: order.created_at ? new Date(order.created_at).toISOString() : null,
            }));

            return {
                orders: mappedOrders,
                total: data?.length || 0
            };

        } catch (error) {
            console.error('Error fetching orders:', error);
            return { orders: [], total: 0 };
        }
    },

    /**
     * Fetch order items for a specific order (MATCHING FLUTTER)
     */
    async fetchOrderItems(orderId: string): Promise<OrderItem[]> {
        try {
            const response = await fetch(
                `${getSupabaseBaseUrl()}/functions/v1/getOrderWithItems?orderId=${orderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Failed to fetch order items');

            const data = await response.json();
            return data.items || [];
        } catch (error) {
            console.error('Error fetching order items:', error);

            // Fallback
            try {
                const { data, error: fallbackError } = await supabase
                    .from('order_items')
                    .select(`
            *,
            product_variants (
              sku,
              variant_name,
              saleprice
            )
          `)
                    .eq('order_id', orderId);

                if (fallbackError) throw fallbackError;
                return data || [];
            } catch (fallbackError) {
                console.error('Fallback failed:', fallbackError);
                return [];
            }
        }
    },

    /**
     * Fetch complete order JSON for invoice generation (MATCHING FLUTTER)
     */
    async fetchOrderJson(orderId: string): Promise<any> {
        try {
            const response = await fetch(
                `${getSupabaseBaseUrl()}/functions/v1/generateinvoice?order_id=${orderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    },
                }
            );

            if (!response.ok) throw new Error('Failed to fetch order JSON');
            return await response.json();
        } catch (error) {
            console.error('Error fetching order JSON:', error);
            return null;
        }
    },

    /**
     * Fetch SKU summary for a specific date (MATCHING FLUTTER)
     */
    async fetchDailySkuSummary(date: Date): Promise<SkuSummary[]> {
        try {
            const targetDate = date.toISOString().split('T')[0];

            const { data, error } = await supabase
                .rpc('daily_sku_summary_with_stock', {
                    p_date: targetDate,
                });

            if (error) {
                console.error('SKU summary fetch error:', error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error('Error fetching SKU summary:', error);
            return [];
        }
    },

    /**
     * Update order status
     */
    async updateOrderStatus(orderId: string, status: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ order_status: status })
                .eq('order_id', orderId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error updating order status:', error);
            return false;
        }
    },

    /**
     * Send order notification email via Edge Function
     */
    async sendOrderNotification(
        type: 'order_received' | 'invoice_generated' | 'order_dispatched' | 'order_delivered' | 'refund_initiated',
        orderId: string,
        trackingId?: string,
        carrier?: string,
        refundAmount?: number,
        refundId?: string
    ): Promise<boolean> {
        try {
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/order-notification`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type,
                    order_id: orderId,
                    tracking_id: trackingId,
                    carrier,
                    refund_amount: refundAmount,
                    refund_id: refundId
                })
            });

            if (!response.ok) throw new Error('Failed to send notification');
            return true;
        } catch (error) {
            console.error('Error sending order notification:', error);
            return false;
        }
    },

    /**
     * Cancel an order (set status to Cancelled)
     */
    async cancelOrder(orderId: string): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ order_status: 'Cancelled', cancelled_by: 'admin' })
                .eq('order_id', orderId);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error cancelling order:', error);
            return false;
        }
    },

    /**
     * Initiate refund via process-refund Edge Function
     * Supports both Razorpay refunds (online orders) and manual refunds (COD/WhatsApp)
     */
    async initiateRefund(orderId: string, refundAmount: number, cancelledBy: string = 'admin', cancellationReason?: string): Promise<{ success: boolean; error?: string; refund_method?: string; message?: string }> {
        try {
            console.log('💳 Initiating refund for order:', orderId, 'amount:', refundAmount);
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/process-refund`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    order_id: orderId,
                    refund_amount: refundAmount,
                    cancelled_by: cancelledBy,
                    cancellation_reason: cancellationReason || (cancelledBy === 'admin' ? 'Admin initiated refund' : 'Customer initiated refund'),
                })
            });

            // Handle non-JSON responses (Edge Function crash, proxy error, etc.)
            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await response.text();
                console.error('❌ Refund: Non-JSON response:', response.status, text.substring(0, 200));
                return { success: false, error: `Server error (${response.status}). The refund service may not be deployed or configured correctly.` };
            }

            const data = await response.json();
            console.log('💳 Refund response:', response.status, data);

            if (!response.ok || !data.success) {
                return { success: false, error: data.error || 'Refund processing failed' };
            }

            return {
                success: true,
                refund_method: data.refund_method || 'razorpay',
                message: data.message || 'Refund processed successfully'
            };
        } catch (error: any) {
            console.error('Error initiating refund:', error);
            return { success: false, error: error.message || 'Network error occurred' };
        }
    },
};
