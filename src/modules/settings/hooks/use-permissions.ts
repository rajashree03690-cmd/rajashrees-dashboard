/**
 * Permissions Hooks
 * React Query hooks for roles and permissions management
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getRoles,
    getRoleWithPermissions,
    createRole,
    updateRolePermissions,
    deleteRole,
    getAllPermissions,
    getPermissionsByCategory,
} from '../services/permissions.service';

// =====================================================
// ROLES
// =====================================================

export function useRoles() {
    return useQuery({
        queryKey: ['roles'],
        queryFn: getRoles,
    });
}

export function useRoleWithPermissions(roleId: string | null) {
    return useQuery({
        queryKey: ['role', roleId],
        queryFn: () => roleId ? getRoleWithPermissions(roleId) : null,
        enabled: !!roleId,
    });
}

export function useCreateRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ name, description, permissionIds }: {
            name: string;
            description: string;
            permissionIds: string[];
        }) => createRole(name, description, permissionIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
    });
}

export function useUpdateRolePermissions() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ roleId, permissionIds }: {
            roleId: string;
            permissionIds: string[];
        }) => updateRolePermissions(roleId, permissionIds),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            queryClient.invalidateQueries({ queryKey: ['role', variables.roleId] });
        },
    });
}

export function useDeleteRole() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (roleId: string) => deleteRole(roleId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roles'] });
        },
    });
}

// =====================================================
// PERMISSIONS
// =====================================================

export function usePermissions() {
    return useQuery({
        queryKey: ['permissions'],
        queryFn: getAllPermissions,
    });
}

export function usePermissionsByCategory() {
    return useQuery({
        queryKey: ['permissions-by-category'],
        queryFn: getPermissionsByCategory,
    });
}
