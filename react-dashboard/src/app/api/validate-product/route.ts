import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const { sku, name, excludeProductId } = await request.json();

        // Check for duplicate SKU
        if (sku) {
            const skuQuery = supabase
                .from('master_product')
                .select('product_id, sku, name')
                .eq('sku', sku);

            if (excludeProductId) {
                skuQuery.neq('product_id', excludeProductId);
            }

            const { data: skuData, error: skuError } = await skuQuery;

            if (skuError) throw skuError;

            if (skuData && skuData.length > 0) {
                return NextResponse.json({
                    valid: false,
                    field: 'sku',
                    message: `SKU "${sku}" already exists for product: ${skuData[0].name}`
                });
            }
        }

        // Check for duplicate product name
        if (name) {
            const nameQuery = supabase
                .from('master_product')
                .select('product_id, sku, name')
                .ilike('name', name); // Case-insensitive match

            if (excludeProductId) {
                nameQuery.neq('product_id', excludeProductId);
            }

            const { data: nameData, error: nameError } = await nameQuery;

            if (nameError) throw nameError;

            if (nameData && nameData.length > 0) {
                return NextResponse.json({
                    valid: false,
                    field: 'name',
                    message: `Product name "${name}" already exists (SKU: ${nameData[0].sku})`
                });
            }
        }

        // No duplicates found
        return NextResponse.json({
            valid: true,
            message: 'No duplicates found'
        });

    } catch (error) {
        console.error('Error validating product:', error);
        return NextResponse.json(
            { error: 'Failed to validate product' },
            { status: 500 }
        );
    }
}
