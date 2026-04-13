import { supabase } from '@/lib/supabase';

export interface CreateUserData {
    email: string;
    password: string;
    full_name: string;
    role: 'Admin' | 'Manager' | 'Executive';
    phone?: string;
    is_Active?: boolean;
}

export interface UpdateUserData {
    full_name?: string;
    role?: 'Admin' | 'Manager' | 'Executive';
    phone?: string;
    avatar_url?: string;
    is_Active?: boolean;
}

export const usersService = {
    /**
     * Fetch all users (admin only)
     */
    async fetchUsers(): Promise<{ data: any[]; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('dashboard_users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { data: data || [] };
        } catch (error) {
            console.error('Error fetching users:', error);
            return { data: [], error: String(error) };
        }
    },

    /**
     * Create a new user (admin only)
     * This creates both the auth user and the profile
     */
    async createUser(userData: CreateUserData): Promise<{ success: boolean; error?: string }> {
        try {
            // Create auth user via Supabase Admin API
            // Note: This requires service role key, should be done via API route
            const response = await fetch('/api/admin/users/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData),
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, error: result.error || 'Failed to create user' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error creating user:', error);
            return { success: false, error: String(error) };
        }
    },

    /**
     * Update user details (admin only)
     */
    async updateUser(userId: string, updates: UpdateUserData): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('dashboard_users')
                .update(updates)
                .eq('id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error updating user:', error);
            return { success: false, error: String(error) };
        }
    },

    /**
     * Deactivate user (soft delete)
     */
    async deactivateUser(userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('dashboard_users')
                .update({ is_Active: false })
                .eq('id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error deactivating user:', error);
            return { success: false, error: String(error) };
        }
    },

    /**
     * Activate user
     */
    async activateUser(userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('dashboard_users')
                .update({ is_Active: true })
                .eq('id', userId);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Error activating user:', error);
            return { success: false, error: String(error) };
        }
    },

    /**
     * Delete user permanently (admin only - use with caution)
     */
    async deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Delete via API route (requires service role key)
            const response = await fetch('/api/admin/users/delete', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId }),
            });

            const result = await response.json();

            if (!response.ok) {
                return { success: false, error: result.error || 'Failed to delete user' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting user:', error);
            return { success: false, error: String(error) };
        }
    },
};
