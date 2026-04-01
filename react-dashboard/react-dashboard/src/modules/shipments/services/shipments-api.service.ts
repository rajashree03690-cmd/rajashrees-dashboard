import type { Shipment } from '@/types/shipments';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

class ShipmentsApiService {
    /**
     * Fetch all shipments with order source (joined from orders table)
     */
    async fetchShipments(): Promise<{ data: Shipment[]; total: number }> {
        try {
            console.log('📡 Fetching shipments...');

            // Simple query - join won't work without foreign key relationship
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/shipment_tracking?select=*`,
                {
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Fetch shipments failed:', errorData);
                return { data: [], total: 0 };
            }

            const result = await response.json();
            console.log('✅ Shipments fetched:', result.length);

            return {
                data: result || [],
                total: result?.length || 0
            };
        } catch (error) {
            console.error('Error fetching shipments:', error);
            return { data: [], total: 0 };
        }
    }

    /**
     * Fetch shipment by order ID
     */
    async fetchShipmentByOrderId(orderId: string): Promise<Shipment | null> {
        try {
            console.log('📡 Fetching shipment for order:', orderId);

            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/shipment_tracking?order_id=eq.${orderId}&select=*`,
                {
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                console.error('❌ Fetch shipment failed:', await response.text());
                return null;
            }

            const result = await response.json();
            console.log('✅ Shipment fetched:', result);

            // Return first result (should only be one)
            return result && result.length > 0 ? result[0] : null;
        } catch (error) {
            console.error('Error fetching shipment:', error);
            return null;
        }
    }

    /**
     * Add or update tracking number for an order (with admin shipping cost)
     */
    async updateTrackingNumber(orderId: string, trackingNumber: string, provider: string, isWebOrder: boolean = true, shippingCost: number = 0): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`📦 Updating tracking for order ${orderId}: ${trackingNumber} via ${provider} (Cost: ₹${shippingCost})`);

<<<<<<< HEAD:react-dashboard/react-dashboard/react-dashboard/src/modules/shipments/services/shipments-api.service.ts
            const url = `${SUPABASE_URL}/functions/v1/updateshipmenttracking?order_id=${orderId}&inline=${inline}`;
=======
            const payload = {
                tracking_number: trackingNumber,
                shipping_provider: provider,
                shipping_status: 'Shipped',
                shipped_date: new Date().toISOString(),
                shipping_cost: shippingCost
            };

            const url = `${getSupabaseBaseUrl()}/functions/v1/updateshipmenttracking?order_id=${orderId}&is_web_order=${isWebOrder}`;
>>>>>>> 49c99a2fbeeeca119250e8d253add75db82d413c:src/modules/shipments/services/shipments-api.service.ts

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Update tracking failed:', errorData);
                return { success: false, error: errorData.error || response.statusText };
            }

            console.log('✅ Tracking updated successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Update Tracking Error:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Send shipment status via Email and WhatsApp
     */
    async sendShipmentStatus(shipments: Shipment[]): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📤 Sending shipment status for', shipments.length, 'shipments');

            const emailPromises = shipments.map(async (shipment) => {
                const { order_id, shipping_status, tracking_number, shipping_provider } = shipment;
                if (!order_id) return;

                try {
                    const type = shipping_status === 'Delivered' ? 'order_delivered' : 'order_dispatched';

                    await fetch(`${getSupabaseBaseUrl()}/functions/v1/order-notification`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            type,
                            order_id,
                            tracking_id: tracking_number,
                            carrier: shipping_provider
                        })
                    });
                } catch (e) {
                    console.error('Failed to send email for shipment', order_id, e);
                }
            });

            await Promise.allSettled(emailPromises);

            return { success: true };
        } catch (error) {
            console.error('❌ Send Status Error:', error);
            return { success: false, error: String(error) };
        }
    }
    /**
     * Fetch Live Tracking Status
     */
    async fetchTracking(orderId: string): Promise<{ data: any; error: any }> {
        try {
            console.log('📡 Fetching live tracking for:', orderId);
            const url = `${SUPABASE_URL}/functions/v1/orders-track?order_id=${orderId}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { data: null, error: errorData.error || `Error ${response.status}: ${response.statusText}` };
            }

            const data = await response.json();
            return { data, error: null };
        } catch (err: any) {
            return { data: null, error: err.message || String(err) };
        }
    }

    /**
     * Delete a shipment tracking record (returns order to Pending)
     */
    async deleteShipmentTracking(orderId: string): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('🗑️ Deleting shipment tracking for:', orderId);

            const response = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/shipment_tracking?order_id=eq.${orderId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Delete shipment tracking failed:', errorData);
                return { success: false, error: errorData.message || response.statusText };
            }

            console.log('✅ Shipment tracking deleted for order:', orderId);
            return { success: true };
        } catch (error) {
            console.error('❌ Delete Shipment Tracking Error:', error);
            return { success: false, error: String(error) };
        }
    }
}

export const shipmentsApiService = new ShipmentsApiService();
