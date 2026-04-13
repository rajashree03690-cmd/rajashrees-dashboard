'use client';

import { useEffect, useState } from 'react';

export interface User {
    user_id: number;
    email: string;
    full_name: string | null;
    role: 'Admin' | 'Manager' | 'Executive';
    is_Active?: boolean;
}

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Get user from localStorage (set by AuthContext)
        try {
            const storedUser = localStorage.getItem('dashboard_user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
            } else {
                setUser(null);
            }
        } catch (err) {
            console.error('Error reading user from localStorage:', err);
            setError('Failed to load user');
        } finally {
            setLoading(false);
        }

        // Listen for storage changes (in case user logs in/out in another tab)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'dashboard_user') {
                if (e.newValue) {
                    setUser(JSON.parse(e.newValue));
                } else {
                    setUser(null);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return { user, loading, error };
}

// Helper hooks for role checking
export function useIsAdmin() {
    const { user, loading } = useUser();
    return {
        isAdmin: user?.role === 'Admin',
        loading
    };
}

export function useCanEdit() {
    const { user, loading } = useUser();
    return {
        canEdit: user?.role === 'Admin' || user?.role === 'Manager',
        loading
    };
}
