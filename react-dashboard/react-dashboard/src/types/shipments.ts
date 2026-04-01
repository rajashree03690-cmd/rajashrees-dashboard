// Shipment Types (matching Flutter's shipment.dart)

export interface Shipment {
    shipment_id?: string;
    order_id?: string;
    tracking_number?: string;
    shipping_provider?: string;
    tracking_url?: string;
    shipping_status?: string;
    shipping_cost?: number;
    remarks?: string;
    shipped_date?: string;
    delivered_date?: string;
    created_at?: string;
    updated_at?: string;
    // Fields from joined orders table
    source?: string;
    customer_name?: string;
    contact_number?: string;
}

export const SHIPPING_PROVIDERS = [
    "DTDC",
    "Franch Express",
    "India Post",
    "Delhivery"
] as const;

export type ShippingProvider = typeof SHIPPING_PROVIDERS[number];
