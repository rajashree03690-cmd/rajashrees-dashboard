import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET all subcategories (optionally filtered by category_id)
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const categoryId = searchParams.get('category_id');

        let query = supabase
            .from('subcategories')
            .select('*, categories(id, name)')
            .order('name');

        if (categoryId) {
            query = query.eq('category_id', parseInt(categoryId));
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error fetching subcategories:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - create a new subcategory
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, category_id } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Subcategory name is required' }, { status: 400 });
        }
        if (!category_id) {
            return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('subcategories')
            .insert({ name: name.trim(), category_id })
            .select('*, categories(id, name)')
            .single();

        if (error) throw error;
        return NextResponse.json(data, { status: 201 });
    } catch (error: any) {
        console.error('Error creating subcategory:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - update a subcategory (name, category, or active status)
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { subcategory_id, name, category_id, is_Active } = body;

        if (!subcategory_id) {
            return NextResponse.json({ error: 'Subcategory ID is required' }, { status: 400 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (category_id !== undefined) updateData.category_id = category_id;
        if (is_Active !== undefined) updateData.is_Active = is_Active;

        const { data, error } = await supabase
            .from('subcategories')
            .update(updateData)
            .eq('subcategory_id', subcategory_id)
            .select('*, categories(id, name)')
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error updating subcategory:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
