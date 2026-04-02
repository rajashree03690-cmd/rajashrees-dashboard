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
        const { user_id, current_user_id } = body;

        // Basic validation
        if (!user_id) {
            return NextResponse.json(
                { error: 'Missing user_id' },
                { status: 400 }
            );
        }

        // 1. Delete user from users table
        const { error: deleteError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('user_id', user_id);

        if (deleteError) {
            console.error('Database error deleting user:', deleteError);
            return NextResponse.json(
                { error: deleteError.message },
                { status: 500 }
            );
        }

        // 2. Also delete from user_roles (if not cascaded)
        // Check if cascade is on? Safest to just try delete.
        await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', user_id);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
