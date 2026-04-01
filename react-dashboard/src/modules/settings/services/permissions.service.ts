/**
 * Permissions Service
 * Handles permission checks and role management
 */

import { createClient } from '@/lib/supabase/client';
import { getTenantFilter } from '@/lib/tenant';
import type {
    Role,
    Permission,
    RoleWithPermissions,
} from '../types/settings.types';

const supabase = createClient();

// =====================================================
// PERMISSION CHECKS
// =====================================================

export async function checkPermission(userId: string, permissionKey: string): Promise<boolean> {
    try {
        // Get user's role
        const { data: user } = await supabase
            .from('dashboard_users')
            .select('role_id')
            .eq('id', userId)
            .single();

        if (!user || !user.role_id) {
            return false;
        }

        // Check if role has permission
        const { data, error } = await supabase
            .from('role_permissions')
            .select(`
        permission_id,
        permissions!inner(key)
      `)
            .eq('role_id', user.role_id)
            .eq('permissions.key', permissionKey)
            .limit(1);

        if (error) {
            console.error('Error checking permission:', error);
            return false;
        }

        return data && data.length > 0;
    } catch (error) {
        console.error('Error in checkPermission:', error);
        return false;
    }
}

export async function getUserPermissions(userId: string): Promise<Permission[]> {
    try {
        const { data: user } = await supabase
            .from('dashboard_users')
            .select('role_id')
            .eq('id', userId)
            .single();

        if (!user || !user.role_id) {
            return [];
        }

        const { data, error } = await supabase
            .from('role_permissions')
            .select(`
        permissions(*)
      `)
            .eq('role_id', user.role_id);

        if (error) {
            console.error('Error fetching user permissions:', error);
            return [];
        }

        return data.map((rp: any) => rp.permissions).filter(Boolean);
    } catch (error) {
        console.error('Error in getUserPermissions:', error);
        return [];
    }
}

// =====================================================
// ROLES
// =====================================================

export async function getRoles(): Promise<Role[]> {
    const { data, error } = await supabase
        .from('roles')
        .select('*')
        .eq('tenant_id', getTenantFilter())
        .order('name');

    if (error) {
        console.error('Error fetching roles:', error);
        return [];
    }

    return data || [];
}

export async function getRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null> {
    const { data: role, error: roleError } = await supabase
        .from('roles')
        .select('*')
        .eq('id', roleId)
        .single();

    if (roleError || !role) {
        console.error('Error fetching role:', roleError);
        return null;
    }

    const { data: rolePermissions, error: permError } = await supabase
        .from('role_permissions')
        .select(`
      permissions(*)
    `)
        .eq('role_id', roleId);

    if (permError) {
        console.error('Error fetching role permissions:', permError);
        return { ...role, permissions: [] };
    }

    const permissions = rolePermissions.map((rp: any) => rp.permissions).filter(Boolean);

    return {
        ...role,
        permissions,
    };
}

export async function createRole(name: string, description: string, permissionIds: string[]): Promise<Role | null> {
    const tenantId = getTenantFilter();

    // Create role
    const { data: role, error: roleError } = await supabase
        .from('roles')
        .insert({
            name,
            description,
            tenant_id: tenantId,
            is_system: false,
        })
        .select()
        .single();

    if (roleError || !role) {
        console.error('Error creating role:', roleError);
        return null;
    }

    // Assign permissions
    if (permissionIds.length > 0) {
        const rolePermissions = permissionIds.map(permId => ({
            role_id: role.id,
            permission_id: permId,
        }));

        const { error: permError } = await supabase
            .from('role_permissions')
            .insert(rolePermissions);

        if (permError) {
            console.error('Error assigning permissions:', permError);
        }
    }

    return role;
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]): Promise<boolean> {
    try {
        // Delete existing permissions
        await supabase
            .from('role_permissions')
            .delete()
            .eq('role_id', roleId);

        // Insert new permissions
        if (permissionIds.length > 0) {
            const rolePermissions = permissionIds.map(permId => ({
                role_id: roleId,
                permission_id: permId,
            }));

            const { error } = await supabase
                .from('role_permissions')
                .insert(rolePermissions);

            if (error) {
                console.error('Error updating permissions:', error);
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('Error in updateRolePermissions:', error);
        return false;
    }
}

export async function deleteRole(roleId: string): Promise<boolean> {
    // Don't allow deleting system roles
    const { data: role } = await supabase
        .from('roles')
        .select('is_system')
        .eq('id', roleId)
        .single();

    if (role?.is_system) {
        console.error('Cannot delete system role');
        return false;
    }

    const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

    if (error) {
        console.error('Error deleting role:', error);
        return false;
    }

    return true;
}

// =====================================================
// PERMISSIONS
// =====================================================

export async function getAllPermissions(): Promise<Permission[]> {
    const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('category, name');

    if (error) {
        console.error('Error fetching permissions:', error);
        return [];
    }

    return data || [];
}

export async function getPermissionsByCategory(): Promise<Record<string, Permission[]>> {
    const permissions = await getAllPermissions();

    const grouped: Record<string, Permission[]> = {};

    permissions.forEach(perm => {
        const category = perm.category || 'Other';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(perm);
    });

    return grouped;
}
