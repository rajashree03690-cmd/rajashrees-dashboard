import { supabase } from '@/lib/supabase';
import type { Order, OrderItem, SkuSummary } from '@/types/orders';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
                `${SUPABASE_URL}/functions/v1/getOrderWithItems?orderId=${orderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${ANON_KEY}`,
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
                `${SUPABASE_URL}/functions/v1/generateinvoice?order_id=${orderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${ANON_KEY}`,
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
};
