'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';

/**
 * Hook to require specific roles for a component/page
 * Redirects to /login or /dashboard if unauthorized
 * 
 * @param allowedRoles - Array of roles that can access this component
 * @param redirectTo - Where to redirect if unauthorized (default: /dashboard)
 */
export function useRequireRole(
    allowedRoles: ('admin' | 'staff' | 'viewer')[],
    redirectTo: string = '/dashboard?error=unauthorized'
) {
    const { user, loading } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        // Not logged in - redirect to login
        if (!user) {
            router.push('/login');
            return;
        }

        // User inactive - redirect to login
        if (!user.is_active) {
            router.push('/login?error=inactive');
            return;
        }

        // User doesn't have required role
        if (!allowedRoles.includes(user.role)) {
            router.push(redirectTo);
            return;
        }
    }, [user, loading, allowedRoles, redirectTo, router]);

    return { user, loading };
}

/**
 * Hook to require admin role specifically
 */
export function useRequireAdmin() {
    return useRequireRole(['admin'], '/dashboard?error=admin_only');
}

/**
 * Hook to require edit permissions (admin or staff)
 */
export function useRequireEdit() {
    return useRequireRole(['admin', 'staff'], '/dashboard?error=edit_permission_required');
}
