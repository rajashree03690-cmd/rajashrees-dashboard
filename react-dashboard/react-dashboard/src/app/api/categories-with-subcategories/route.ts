import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        // Fetch categories with their subcategories
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('id, name')
            .order('name');

        if (catError) throw catError;

        // Fetch all subcategories
        const { data: subcategories, error: subError } = await supabase
            .from('subcategories')
            .select('subcategory_id, name, category_id')
            .order('name');

        if (subError) throw subError;

        // Nest subcategories under their categories
        const categoriesWithSubs = categories.map(cat => ({
            category_id: cat.id,
            category_name: cat.name,
            subcategories: subcategories
                .filter(sub => sub.category_id === cat.id)
                .map(sub => ({
                    subcategory_id: sub.subcategory_id,
                    name: sub.name
                }))
        }));

        return NextResponse.json(categoriesWithSubs);
    } catch (error) {
        console.error('Error fetching categories with subcategories:', error);
        return NextResponse.json(
            { error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}
