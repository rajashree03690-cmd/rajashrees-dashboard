/**
 * usePermission Hook
 * Permission-based component rendering
 */

'use client';

import { useState, useEffect } from 'react';
import { checkPermission, getUserPermissions } from '@/modules/settings/services/permissions.service';
import type { Permission } from '@/modules/settings/types/settings.types';

export function usePermission(permissionKey: string) {
    const [hasPermission, setHasPermission] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkUserPermission() {
            try {
                // Get current user ID from session
                const userId = await getCurrentUserId();

                if (!userId) {
                    setHasPermission(false);
                    setLoading(false);
                    return;
                }

                const permitted = await checkPermission(userId, permissionKey);
                setHasPermission(permitted);
            } catch (error) {
                console.error('Error checking permission:', error);
                setHasPermission(false);
            } finally {
                setLoading(false);
            }
        }

        checkUserPermission();
    }, [permissionKey]);

    return { hasPermission, loading };
}

export function useUserPermissions() {
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadPermissions() {
            try {
                const userId = await getCurrentUserId();

                if (!userId) {
                    setPermissions([]);
                    setLoading(false);
                    return;
                }

                const userPerms = await getUserPermissions(userId);
                setPermissions(userPerms);
            } catch (error) {
                console.error('Error loading permissions:', error);
                setPermissions([]);
            } finally {
                setLoading(false);
            }
        }

        loadPermissions();
    }, []);

    const hasPermission = (key: string) => {
        return permissions.some(p => p.key === key);
    };

    return { permissions, hasPermission, loading };
}

// Helper to get current user ID from Supabase session
async function getCurrentUserId(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        return session?.user?.id || null;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
}
