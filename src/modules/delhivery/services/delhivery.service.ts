import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';

export interface CreateShipmentParams {
    orderId: string;
    pickupLocation: string;
    customerName: string;
    customerPhone: string;
    shippingAddress: string;
    shippingCity: string;
    shippingState: string;
    shippingPincode: string;
    paymentMode: 'Pre-paid' | 'Prepaid' | 'COD';
    codAmount: number;
    totalAmount: number;
    weightGrams: number;
    quantity: number;
    productsDesc?: string;
    shippingMode?: 'Surface' | 'Express';
}

export const delhiveryService = {
    /**
     * Call Supabase Edge Function to Create a Delhivery Shipment
     */
    async createShipment(params: CreateShipmentParams): Promise<{ success: boolean; waybill?: string; error?: string }> {
        try {
            const payload = {
                pickup_location: {
                    name: params.pickupLocation
                },
                shipments: [
                    {
                        name: params.customerName,
                        add: params.shippingAddress,
                        pin: params.shippingPincode,
                        city: params.shippingCity,
                        state: params.shippingState,
                        country: "India",
                        phone: params.customerPhone,
                        order: params.orderId,
                        payment_mode: params.paymentMode === 'Pre-paid' ? 'Prepaid' : params.paymentMode,
                        products_desc: params.productsDesc || "Clothing & Accessories",
                        hsn_code: "6206", // Default HSN for Women Clothing
                        cod_amount: params.paymentMode === 'COD' ? (params.codAmount || 0).toString() : "0",
                        order_date: new Date().toISOString(),
                        total_amount: (params.totalAmount || 0).toString(),
                        shipping_mode: params.shippingMode || "Surface",
                        quantity: (params.quantity || 1).toString(),
                        weight: (params.weightGrams || 500).toString(),
                        seller_name: "Rajashree Fashion",
                        seller_add: "Govindharajapuram, Nandhivaram, Guduvancherry, Chennai",
                        seller_pin: "603202",
                        seller_city: "Chennai",
                        seller_state: "Tamil Nadu",
                        return_name: "Rajashree Fashion",
                        return_add: "Govindharajapuram, Nandhivaram, Guduvancherry, Chennai",
                        return_pin: "603202",
                        return_city: "Chennai",
                        return_state: "Tamil Nadu",
                        return_phone: "7010335658",
                        return_country: "India"
                    }
                ]
            };

            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'create_shipment',
                    payload: payload
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to create shipment');
            }

            const data = await response.json();

            // Debug: Log full response structure to see what Delhivery returns
            console.log('📦 Delhivery createShipment full response:', JSON.stringify(data, null, 2));

            // The EF returns { success, data: <raw delhivery response> }
            const delhiveryResponse = data.data;

            if (!delhiveryResponse) {
                return { success: false, error: 'Empty response from Delhivery Edge Function' };
            }

            // Structure 1: Standard packages array
            if (delhiveryResponse.packages && delhiveryResponse.packages.length > 0) {
                const pkg = delhiveryResponse.packages[0];
                if (pkg.status === 'Success' && pkg.waybill) {
                    return { success: true, waybill: pkg.waybill };
                } else if (pkg.remarks && pkg.remarks.length > 0) {
                    return { success: false, error: pkg.remarks.join(', ') };
                }
            }

            // Structure 2: Direct success with waybill at top level
            if (delhiveryResponse.success && delhiveryResponse.waybill) {
                return { success: true, waybill: delhiveryResponse.waybill };
            }

            // Structure 3: upload_wbn format (Delhivery v2 API)
            if (delhiveryResponse.upload_wbn) {
                return { success: true, waybill: delhiveryResponse.upload_wbn };
            }

            // Structure 4: Check for error messages
            if (delhiveryResponse.error && delhiveryResponse.error.length > 0) {
                const errors = Array.isArray(delhiveryResponse.error) 
                    ? delhiveryResponse.error.join(', ') 
                    : String(delhiveryResponse.error);
                return { success: false, error: errors || delhiveryResponse.rmk };
            }

            // Structure 5: rmk (remark) field as error
            if (delhiveryResponse.rmk) {
                return { success: false, error: delhiveryResponse.rmk };
            }

            // If we still can't parse it, include the raw data in the error for debugging
            return { success: false, error: `Unexpected Delhivery response structure. Check console for details.` };
        } catch (error: any) {
            console.error('Error creating shipment:', error);
            return { success: false, error: error.message || 'Network error occurred' };
        }
    },

    /**
     * Track a Shipment by Waybill
     */
    async trackShipment(waybill: string): Promise<{ success: boolean; trackingData?: any; error?: string }> {
        try {
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'track_shipment',
                    payload: { waybill }
                })
            });

            if (!response.ok) throw new Error('Failed to track shipment');

            const data = await response.json();
            return { success: true, trackingData: data.data };
        } catch (error: any) {
            console.error('Error tracking shipment:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Generate Label PDF for a Waybill
     */
    async generateLabel(waybill: string): Promise<{ success: boolean; pdfUrl?: string; pdfUrls?: string[]; pdfEncodings?: string[]; error?: string }> {
        try {
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'generate_label',
                    payload: { waybill }
                })
            });

            if (!response.ok) throw new Error('Failed to generate label');

            const data = await response.json();
            
            // Collect individual package links and encodings
            const pdfUrls = data.data?.packages?.map((p: any) => p.pdf_download_link).filter(Boolean) || [];
            const pdfEncodings = data.data?.packages?.map((p: any) => p.pdf_encoding).filter(Boolean) || [];
            
            // Check for combined PDF URL (bulk labels via redirect capture) or fallback to first link
            const pdfUrl = data.data?.combined_pdf || pdfUrls[0] || null;
            
            return { success: true, pdfUrl, pdfUrls, pdfEncodings };
        } catch (error: any) {
            console.error('Error generating label:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Request Pickup for a specific date and location
     */
    async requestPickup(pickupDate: string, pickupTime: string, expectedCount: number, pickupLocation: string): Promise<{ success: boolean; error?: string }> {
        try {
            const payload = {
                pickup_time: pickupTime, // '14:00:00'
                pickup_date: pickupDate, // 'YYYY-MM-DD'
                pickup_location: pickupLocation,
                expected_package_count: expectedCount
            };

            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'pickup_request',
                    payload: payload
                })
            });

            if (!response.ok) throw new Error('Failed to request pickup');

            const data = await response.json();
            if (data.data?.pickup_id) {
                return { success: true };
            }
            return { success: false, error: data.data?.error || "Unknown error during pickup request" };
        } catch (error: any) {
            console.error('Error requesting pickup:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Cancel a Delhivery Shipment (before pickup)
     */
    async cancelShipment(waybill: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'cancel_shipment',
                    payload: { waybill }
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to cancel shipment');
            }

            const data = await response.json();
            return { success: true };
        } catch (error: any) {
            console.error('Error cancelling shipment:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Update Shipment details (before pickup)
     */
    async updateShipment(waybill: string, updates: Record<string, string>): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'update_shipment',
                    payload: { waybill, updates }
                })
            });

            if (!response.ok) throw new Error('Failed to update shipment');
            return { success: true };
        } catch (error: any) {
            console.error('Error updating shipment:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Calculate Shipping Cost estimate
     */
    async calculateShippingCost(
        originPin: string,
        destinationPin: string,
        weightGrams: number,
        codAmount?: number,
        mode: 'S' | 'E' = 'S'
    ): Promise<{ success: boolean; charges?: any; error?: string }> {
        try {
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'calculate_cost',
                    payload: {
                        origin_pin: originPin,
                        destination_pin: destinationPin,
                        weight: weightGrams,
                        cod_amount: codAmount,
                        mode
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to calculate shipping cost');
            const data = await response.json();
            return { success: true, charges: data.data };
        } catch (error: any) {
            console.error('Error calculating shipping cost:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Create Reverse Pickup (for returns)
     */
    async reversePickup(params: {
        waybill: string;
        pickupDate: string;
        pickupTime: string;
        pickupLocation: string;
        customerName: string;
        customerPhone: string;
        customerAddress: string;
        customerPincode: string;
        customerCity: string;
        customerState: string;
    }): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'reverse_pickup',
                    payload: {
                        pickup_date: params.pickupDate,
                        pickup_time: params.pickupTime,
                        pickup_location: params.pickupLocation,
                        name: params.customerName,
                        phone: params.customerPhone,
                        add: params.customerAddress,
                        pin: params.customerPincode,
                        city: params.customerCity,
                        state: params.customerState,
                        country: 'India',
                        waybill: params.waybill,
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to create reverse pickup');
            return { success: true };
        } catch (error: any) {
            console.error('Error creating reverse pickup:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Take NDR (Non-Delivery Report) Action
     */
    async ndrAction(waybill: string, action: string, comments?: string): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'ndr_action',
                    payload: {
                        waybill,
                        ndr_action: action,
                        ndr_comments: comments
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to process NDR action');
            return { success: true };
        } catch (error: any) {
            console.error('Error processing NDR action:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Check if a pincode is serviceable by Delhivery
     */
    async checkPincode(pincode: string, shippingMode: 'Surface' | 'Express' = 'Surface'): Promise<{
        serviceable: boolean;
        pre_paid?: boolean;
        cod?: boolean;
        pickup?: boolean;
        city?: string;
        state?: string;
        center?: string;
        error?: string;
    }> {
        try {
            if (!pincode || pincode.length !== 6) {
                return { serviceable: false, error: 'Invalid pincode' };
            }

            const response = await fetch(`${getSupabaseBaseUrl()}/functions/v1/delhivery`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'check_pincode',
                    payload: { pincode }
                })
            });

            if (!response.ok) throw new Error('Pincode check failed');
            const result = await response.json();

            if (result.success && result.data && result.data.serviceable) {
                return result.data;
            }
            return { serviceable: false, error: result.error || 'Unknown error' };
        } catch (error: any) {
            console.error('Error checking pincode:', error);
            return { serviceable: false, error: error.message };
        }
    }
};

