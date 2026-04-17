import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('name');

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json(
            { error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}

// POST - create a new category
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, image_url } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
        }

        const insertData: any = { name: name.trim() };
        if (image_url) insertData.image_url = image_url;

        const { data, error } = await supabase
            .from('categories')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data, { status: 201 });
    } catch (error: any) {
        console.error('Error creating category:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - update a category (name, active status, or image)
export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, name, is_active, image_url } = body;

        if (!id) {
            return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (is_active !== undefined) updateData.is_active = is_active;
        if (image_url !== undefined) updateData.image_url = image_url;

        const { data, error } = await supabase
            .from('categories')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Error updating category:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
