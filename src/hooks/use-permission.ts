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
                // Check if admin first
                if (typeof window !== 'undefined') {
                    const storedUser = localStorage.getItem('dashboard_user');
                    if (storedUser) {
                        const user = JSON.parse(storedUser);
                        if (user.role && user.role.toLowerCase() === 'admin') {
                            setHasPermission(true);
                            setLoading(false);
                            return; // Admins automatically have all permissions
                        }
                    }
                }

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
    const [isAdminRole, setIsAdminRole] = useState(false);

    useEffect(() => {
        async function loadPermissions() {
            try {
                // Check if admin first
                if (typeof window !== 'undefined') {
                    const storedUser = localStorage.getItem('dashboard_user');
                    if (storedUser) {
                        const user = JSON.parse(storedUser);
                        if (user.role && user.role.toLowerCase() === 'admin') {
                            setIsAdminRole(true);
                            setLoading(false);
                            return; // Admins don't need to load specific DB permissions for UI checks
                        }
                    }
                }

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
        // Admins automatically have all permissions
        if (isAdminRole) return true;
        return permissions.some(p => p.permission_name === key);
    };

    return { permissions, hasPermission, loading };
}

// Helper to get current user ID from custom auth session
async function getCurrentUserId(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    try {
        const storedUser = localStorage.getItem('dashboard_user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            // Support both id and user_id depending on how it's stored
            return user.id || user.user_id || null;
        }
        return null;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
}
