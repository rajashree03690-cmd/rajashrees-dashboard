import type { VendorLedgerEntry, VendorBalance, PaymentRequest } from '@/types/vendor-ledger';
import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';

class VendorLedgerService {
    /**
     * Fetch vendor ledger entries
     */
    async fetchVendorLedger(vendorId: number): Promise<{ data: VendorLedgerEntry[]; success: boolean }> {
        try {
            console.log('📡 Fetching vendor ledger for vendor:', vendorId);

            const response = await fetch(
                `${getSupabaseBaseUrl()}/functions/v1/get-vendor-ledger?vendor_id=${vendorId}`,
                {
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Fetch vendor ledger failed:', errorData);
                return { data: [], success: false };
            }

            const result = await response.json();
            console.log('✅ Vendor ledger fetched:', result);

            return {
                data: result.ledger || result.data || [],
                success: true
            };
        } catch (error) {
            console.error('Error fetching vendor ledger:', error);
            return { data: [], success: false };
        }
    }

    /**
     * Get vendor balance summary
     */
    async getVendorBalance(vendorId: number): Promise<{ data: VendorBalance; success: boolean }> {
        try {
            console.log('📡 Fetching vendor balance for vendor:', vendorId);

            const response = await fetch(
                `${getSupabaseBaseUrl()}/functions/v1/get-vendor-balance?vendor_id=${vendorId}`,
                {
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Fetch vendor balance failed:', errorData);
                return {
                    data: {
                        vendor_id: vendorId,
                        name: '',
                        current_balance: 0,
                        total_purchases: 0,
                        total_paid: 0
                    },
                    success: false
                };
            }

            const result = await response.json();
            console.log('✅ Vendor balance fetched:', result);

            return {
                data: result.balance || result.data || {
                    vendor_id: vendorId,
                    name: '',
                    current_balance: 0,
                    total_purchases: 0,
                    total_paid: 0
                },
                success: true
            };
        } catch (error) {
            console.error('Error fetching vendor balance:', error);
            return {
                data: {
                    vendor_id: vendorId,
                    name: '',
                    current_balance: 0,
                    total_purchases: 0,
                    total_paid: 0
                },
                success: false
            };
        }
    }

    /**
     * Get outstanding invoices for a vendor
     */
    async getOutstandingInvoices(vendorId: number): Promise<{ data: any[]; success: boolean }> {
        try {
            console.log('📡 Fetching outstanding invoices for vendor:', vendorId);

            const response = await fetch(
                `${getSupabaseBaseUrl()}/functions/v1/get-outstanding-invoices?vendor_id=${vendorId}`,
                {
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Fetch outstanding invoices failed:', errorData);
                return { data: [], success: false };
            }

            const result = await response.json();
            console.log('✅ Outstanding invoices fetched:', result);

            return {
                data: result.invoices || result.data || [],
                success: true
            };
        } catch (error) {
            console.error('Error fetching outstanding invoices:', error);
            return { data: [], success: false };
        }
    }

    /**
     * Record a payment
     */
    async recordPayment(paymentData: PaymentRequest): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📤 Recording payment:', paymentData);

            const response = await fetch(
                `${getSupabaseBaseUrl()}/functions/v1/record-vendor-payment`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(paymentData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Record payment failed:', errorData);
                return { success: false, error: errorData.error || response.statusText };
            }

            const result = await response.json();
            console.log('✅ Payment recorded successfully:', result);
            return { success: true };
        } catch (error) {
            console.error('❌ Record Payment Error:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Toggle vendor active status
     */
    async toggleVendorStatus(vendorId: number, isActive: boolean): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📝 Toggling vendor status:', vendorId, isActive);

            const response = await fetch(
                `${getSupabaseBaseUrl()}/functions/v1/toggle-vendor-status`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ vendor_id: vendorId, is_Active: isActive }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Toggle vendor status failed:', errorData);
                return { success: false, error: errorData.error || response.statusText };
            }

            console.log('✅ Vendor status toggled successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Toggle Vendor Status Error:', error);
            return { success: false, error: String(error) };
        }
    }
}

export const vendorLedgerService = new VendorLedgerService();
