export interface Combo {
    combo_id: number;
    name: string;
    sku: string;
    saleprice: number;
    regularprice: number;
    description?: string;
    image_url?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ComboItem {
    combo_item_id: number;
    combo_id: number;
    variant_id: number;
    quantity_per_combo: number;
    created_at: string;
}

export interface ComboItemInput {
    variant_id: number;
    quantity_per_combo: number;
}

export interface ComboFormData {
    name: string;
    sku: string;
    saleprice: number;
    regularprice: number;
    description?: string;
    image_url?: string;
    items: ComboItemInput[];
}
