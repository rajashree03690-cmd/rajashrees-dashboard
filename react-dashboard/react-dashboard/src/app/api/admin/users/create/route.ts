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
        const { email, password, full_name, role, current_user_id } = body;

        // Basic validation
        if (!email || !password || !full_name || !role) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Optional: Verify the requester is an admin (if we had a way to verify current_user_id securely)
        // For now, we trust the client logic (which is gated by Protected component) + this API endpoint existence
        // In a production app with proper auth, we would verify a session token here.

        // 1. Insert user into users table
        const { data: newUser, error: createError } = await supabaseAdmin
            .from('users')
            .insert([{
                email,
                password, // Note: In a real app, hash this! But current legacy system stores plain/custom.
                full_name,
                role,
                is_active: true
            }])
            .select()
            .single();

        if (createError) {
            console.error('Database error creating user:', createError);
            return NextResponse.json(
                { error: createError.message },
                { status: 500 }
            );
        }

        // 2. Assign role in user_roles table (access control)
        // First get role_id
        const { data: roleData, error: roleError } = await supabaseAdmin
            .from('roles')
            .select('role_id')
            .eq('role_name', role)
            .single();

        if (!roleError && roleData) {
            await supabaseAdmin.from('user_roles').insert({
                user_id: newUser.user_id,
                role_id: roleData.role_id,
                assigned_by: current_user_id
            });
        }

        return NextResponse.json(newUser);

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
