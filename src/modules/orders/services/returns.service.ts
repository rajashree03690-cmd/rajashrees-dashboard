import type { Return } from '@/types/returns';
import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';


class ReturnsService {
    /**
     * Fetch all returns
     */
    async fetchReturns(): Promise<{ data: Return[]; error?: string }> {
        try {
            const response = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/returns?order=return_date.desc`,
                {
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    },
                }
            );

            if (!response.ok) {
                return { data: [], error: 'Failed to fetch returns' };
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error('Error fetching returns:', error);
            return { data: [], error: String(error) };
        }
    }

    /**
     * Add new return
     */
    async addReturn(returnData: Return): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/returns`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation',
                    },
                    body: JSON.stringify({
                        order_id: returnData.order_id,
                        return_date: returnData.return_date || new Date().toISOString(),
                        status: returnData.status,
                        reason: returnData.reason,
                        returned_items: returnData.returned_items,
                        refund_amount: returnData.refund_amount,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.message || 'Failed to add return' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error adding return:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Update return status
     */
    async updateStatus(returnId: number, status: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/returns?return_id=eq.${returnId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        status,
                        updated_at: new Date().toISOString(),
                    }),
                }
            );

            if (!response.ok) {
                return { success: false, error: 'Failed to update status' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating status:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Update return details
     */
    async updateReturnDetails(
        returnId: number,
        updates: { status?: string; reason?: string; returned_items?: string }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/returns?return_id=eq.${returnId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...updates,
                        updated_at: new Date().toISOString(),
                    }),
                }
            );

            if (!response.ok) {
                return { success: false, error: 'Failed to update return' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating return:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Delete return
     */
    async deleteReturn(returnId: number): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/returns?return_id=eq.${returnId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    },
                }
            );

            if (!response.ok) {
                return { success: false, error: 'Failed to delete return' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting return:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Process refund for an approved return
     * Updates status to 'Refund Initiated' and triggers Razorpay refund via EF
     */
    async processRefund(returnId: number, orderId: string, refundAmount: number): Promise<{ success: boolean; error?: string }> {
        try {
            // Step 1: Update return status to 'Refund Initiated'
            const statusResult = await this.updateStatus(returnId, 'Refund Initiated');
            if (!statusResult.success) {
                return { success: false, error: 'Failed to update return status' };
            }

            // Step 2: Call process-refund Edge Function (if deployed)
            try {
                const response = await fetch(
                    `${getSupabaseBaseUrl()}/functions/v1/process-refund`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': getSupabaseAnonKey(),
                            'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            return_id: returnId,
                            order_id: orderId,
                            refund_amount: refundAmount,
                        }),
                    }
                );

                if (response.ok) {
                    // EF processed refund, update status to 'Refunded'
                    await this.updateStatus(returnId, 'Refunded');
                    return { success: true };
                } else {
                    // EF failed but status is already 'Refund Initiated'
                    console.warn('Refund EF returned non-OK, status set to Refund Initiated for manual processing');
                    return { success: true }; // Still success — admin can process manually
                }
            } catch {
                // EF not deployed — status already set to 'Refund Initiated'
                console.warn('Refund EF not reachable, manual refund processing required');
                return { success: true };
            }
        } catch (error) {
            console.error('Error processing refund:', error);
            return { success: false, error: String(error) };
        }
    }
}

export const returnsService = new ReturnsService();
