import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function verifyAdmin(request: NextRequest) {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            authorized: false,
            response: NextResponse.json({ error: 'Unauthorized: User not logged in' }, { status: 401 })
        };
    }

    // Check if user is admin - Check `users` table locally, or just rely on the session if role is in metadata.
    // Based on schema, user role is in `users` table ('role' column) or `dashboard_users`.
    // Let's check `users` (public.users) as defined in schema.

    // Using service role admin client to check public.users table (to avoid RLS issues on self-lookup if restricted)
    // Actually, `createClient` uses server component client which has user context. It should be able to read own profile.

    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id) // Assuming auth_id links to auth.users.id
        .single();

    // Fallback: Check dashboard_users if users table empty or fails
    if (userError || !userData) {
        const { data: dashboardUser } = await supabase
            .from('dashboard_users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (dashboardUser && ['admin', 'super_admin'].includes(dashboardUser.role)) {
            return { authorized: true, user, role: dashboardUser.role };
        }
    }

    if (userData && ['admin', 'super_admin', 'Administrator'].includes(userData.role)) { // Add flexible role checks
        return { authorized: true, user, role: userData.role };
    }

    // Also check Supabase Auth Metadata just in case
    const role = user.app_metadata?.role || user.user_metadata?.role;
    if (role === 'admin' || role === 'super_admin') {
        return { authorized: true, user, role };
    }

    return {
        authorized: false,
        response: NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 })
    };
}
