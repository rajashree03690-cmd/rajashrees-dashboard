import type { Purchase } from '@/types/purchases';
import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';


class PurchasesApiService {
    /**
     * Fetch all purchases with vendor details and items (matching Flutter line 25-49)
     */
    async fetchPurchases(): Promise<{ data: Purchase[]; total: number }> {
        try {
            console.log('📡 Fetching purchases...');

            // Direct REST API call matching Flutter's approach
            const response = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/purchase?select=*,vendor(*),purchase_items(*,product_variants(*))`,
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
                console.error('❌ Fetch purchases failed:', errorData);
                return { data: [], total: 0 };
            }

            const result = await response.json();
            console.log('✅ Purchases fetched:', result);

            return {
                data: result || [],
                total: result?.length || 0
            };
        } catch (error) {
            console.error('Error fetching purchases:', error);
            return { data: [], total: 0 };
        }
    }

    /**
     * Add new purchase with items + stock update + vendor transaction
     * Matching Flutter's addPurchase method (lines 53-172)
     */
    async addPurchase(purchaseData: any): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('📤 Adding purchase:', purchaseData);

            // 1️⃣ Insert purchase (Flutter lines 75-88)
            const purchaseBody: any = {
                invoice_no: purchaseData.invoice_no,  // Changed from invoice_number
                invoice_date: purchaseData.invoice_date || new Date().toISOString(),
                vendor_id: purchaseData.vendor_id,
                amount: purchaseData.amount,  // Changed from total_amount
            };

            if (purchaseData.invoice_image) {  // Changed from invoice_image_url
                purchaseBody.invoice_image = purchaseData.invoice_image;
            }

            const purchaseRes = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/purchase`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation',
                    },
                    body: JSON.stringify(purchaseBody),
                }
            );

            if (!purchaseRes.ok) {
                const errorData = await purchaseRes.json();
                console.error('❌ Add purchase failed:', errorData);
                return { success: false, error: errorData.message || purchaseRes.statusText };
            }

            const purchaseResult = await purchaseRes.json();
            const purchaseId = purchaseResult[0]?.purchase_id;

            if (!purchaseId) {
                return { success: false, error: 'Failed to get purchase_id' };
            }

            // 2️⃣ Insert purchase items + update stock (Flutter lines 91-142)
            for (const item of purchaseData.items) {
                // Insert purchase item
                const itemRes = await fetch(
                    `${getSupabaseBaseUrl()}/rest/v1/purchase_items`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': getSupabaseAnonKey(),
                            'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation',
                        },
                        body: JSON.stringify({
                            purchase_id: purchaseId,
                            variant_id: item.variant_id,
                            quantity: item.quantity,
                            cost_price: item.cost_price * item.quantity,  // Dialog sends cost_price per unit
                        }),
                    }
                );

                if (!itemRes.ok) {
                    console.warn('⚠️ Failed to add item:', await itemRes.text());
                    continue;
                }

                // Update stock
                try {
                    // Get current stock
                    const stockRes = await fetch(
                        `${getSupabaseBaseUrl()}/rest/v1/product_variants?select=stock&variant_id=eq.${item.variant_id}`,
                        {
                            headers: {
                                'apikey': getSupabaseAnonKey(),
                                'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                            },
                        }
                    );

                    if (stockRes.ok) {
                        const stockData = await stockRes.json();
                        const currentStock = stockData[0]?.stock || 0;
                        const newStock = currentStock + item.quantity;

                        // Update stock
                        await fetch(
                            `${getSupabaseBaseUrl()}/rest/v1/product_variants?variant_id=eq.${item.variant_id}`,
                            {
                                method: 'PATCH',
                                headers: {
                                    'apikey': getSupabaseAnonKey(),
                                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ stock: newStock }),
                            }
                        );
                    }
                } catch (stockError) {
                    console.warn('⚠️ Stock update failed:', stockError);
                }
            }

            // 4️⃣ Create vendor ledger entry - DEBIT (increases liability)
            try {
                await fetch(
                    `${getSupabaseBaseUrl()}/rest/v1/vendor_ledger`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': getSupabaseAnonKey(),
                            'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation',
                        },
                        body: JSON.stringify({
                            vendor_id: purchaseData.vendor_id,
                            transaction_date: purchaseData.invoice_date || new Date().toISOString(),
                            transaction_type: 'DEBIT',
                            reference_type: 'PURCHASE',
                            reference_id: purchaseId,
                            debit_amount: purchaseData.amount,
                            credit_amount: 0,
                            description: `Purchase Invoice: ${purchaseData.invoice_no}`,
                            invoice_no: purchaseData.invoice_no,
                        }),
                    }
                );
                console.log('✅ Vendor ledger DEBIT entry created');
            } catch (ledgerError) {
                console.warn('⚠️ Vendor ledger entry failed:', ledgerError);
            }

            console.log('✅ Purchase added successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Add Purchase Error:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Delete purchase (direct REST API)
     */
    async deletePurchase(purchaseId: number): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('🗑️ Deleting purchase:', purchaseId);

            // Delete purchase items first
            await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/purchase_items?purchase_id=eq.${purchaseId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    },
                }
            );

            // Delete purchase
            const response = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/purchase?purchase_id=eq.${purchaseId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Delete purchase failed:', errorData);
                return { success: false, error: errorData.message || response.statusText };
            }

            console.log('✅ Purchase deleted successfully');
            return { success: true };
        } catch (error) {
            console.error('❌ Delete Purchase Error:', error);
            return { success: false, error: String(error) };
        }
    }
}

export const purchasesApiService = new PurchasesApiService();
