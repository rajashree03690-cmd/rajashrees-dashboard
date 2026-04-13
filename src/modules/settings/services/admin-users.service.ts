/**
 * Admin Users Service
 * Handles admin user CRUD (never mix with customer users)
 */

import { createClient } from '@/lib/supabase/client';
import type {
    AdminUser,
    CreateAdminUserData,
    UpdateAdminUserData,
} from '../types/settings.types';

const supabase = createClient();

// =====================================================
// ADMIN USERS CRUD
// =====================================================

export async function getAdminUsers(): Promise<AdminUser[]> {
    const { data, error } = await supabase
        .from('dashboard_users')
        .select(`
      *,
      role:roles(*)
    `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching admin users:', error);
        return [];
    }

    return data || [];
}

export async function getAdminUser(id: string): Promise<AdminUser | null> {
    const { data, error } = await supabase
        .from('dashboard_users')
        .select(`
      *,
      role:roles(*)
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching admin user:', error);
        return null;
    }

    return data;
}

export async function createAdminUser(userData: CreateAdminUserData): Promise<AdminUser | null> {
    try {
        // Create auth user first
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    full_name: userData.full_name,
                },
            },
        });

        if (authError || !authData.user) {
            console.error('Error creating auth user:', authError);
            return null;
        }

        // Create dashboard user record
        const { data: user, error: userError } = await supabase
            .from('dashboard_users')
            .insert({
                id: authData.user.id,
                email: userData.email,
                full_name: userData.full_name,
                role_id: userData.role_id,
                is_Active: true,
            })
            .select(`
        *,
        role:roles(*)
      `)
            .single();

        if (userError) {
            console.error('Error creating dashboard user:', userError);
            return null;
        }

        return user;
    } catch (error) {
        console.error('Error in createAdminUser:', error);
        return null;
    }
}

export async function updateAdminUser(id: string, updates: UpdateAdminUserData): Promise<AdminUser | null> {
    const { data, error } = await supabase
        .from('dashboard_users')
        .update(updates)
        .eq('id', id)
        .select(`
      *,
      role:roles(*)
    `)
        .single();

    if (error) {
        console.error('Error updating admin user:', error);
        return null;
    }

    return data;
}

export async function deleteAdminUser(id: string): Promise<boolean> {
    // Soft delete - set is_Active to false
    const { error } = await supabase
        .from('dashboard_users')
        .update({ is_Active: false })
        .eq('id', id);

    if (error) {
        console.error('Error deleting admin user:', error);
        return false;
    }

    return true;
}

export async function toggleAdminUserStatus(id: string, isActive: boolean): Promise<boolean> {
    const { error } = await supabase
        .from('dashboard_users')
        .update({ is_Active: isActive })
        .eq('id', id);

    if (error) {
        console.error('Error toggling user status:', error);
        return false;
    }

    return true;
}
