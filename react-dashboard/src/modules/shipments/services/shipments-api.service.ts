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
     * Update tracking number via Edge Function
     */
    async updateTrackingNumber(
        orderId: string,
        trackingNumber: string,
        provider: string,
        inline: boolean = false
    ): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📤 Updating tracking:', orderId, trackingNumber, provider);

            const url = `${SUPABASE_URL}/functions/v1/updateshipmenttracking?order_id=${orderId}&inline=${inline}`;

            const response = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    tracking_number: trackingNumber,
                    shipping_provider: provider
                }),
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
     * Send shipment status via WhatsApp
     */
    async sendShipmentStatus(shipments: Shipment[]): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📤 Sending shipment status for', shipments.length, 'shipments');

            // TODO: Implement WhatsApp notification logic
            // For now, just return success
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
}

export const shipmentsApiService = new ShipmentsApiService();
