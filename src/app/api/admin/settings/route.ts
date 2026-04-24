import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with the SERVICE ROLE key to bypass RLS
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, updates } = body;

        if (!updates) {
            return NextResponse.json(
                { error: 'Missing updates payload' },
                { status: 400 }
            );
        }

        let query = supabaseAdmin
            .from('app_settings')
            .update({ ...updates, updated_at: new Date().toISOString() });

        if (id) {
            query = query.eq('id', id);
        } else {
            query = query.is('tenant_id', null);
        }

        const { data, error } = await query.select().single();

        if (error) {
            console.error('Database error updating settings:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
