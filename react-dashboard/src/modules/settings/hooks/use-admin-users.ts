/**
 * Admin Users Hooks
 * React Query hooks for admin user management
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAdminUsers,
    getAdminUser,
    createAdminUser,
    updateAdminUser,
    deleteAdminUser,
    toggleAdminUserStatus,
} from '../services/admin-users.service';
import type {
    CreateAdminUserData,
    UpdateAdminUserData,
} from '../types/settings.types';

// =====================================================
// ADMIN USERS
// =====================================================

export function useAdminUsers() {
    return useQuery({
        queryKey: ['admin-users'],
        queryFn: getAdminUsers,
    });
}

export function useAdminUser(id: string | null) {
    return useQuery({
        queryKey: ['admin-user', id],
        queryFn: () => id ? getAdminUser(id) : null,
        enabled: !!id,
    });
}

export function useCreateAdminUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CreateAdminUserData) => createAdminUser(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}

export function useUpdateAdminUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateAdminUserData }) =>
            updateAdminUser(id, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
            queryClient.invalidateQueries({ queryKey: ['admin-user', variables.id] });
        },
    });
}

export function useDeleteAdminUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => deleteAdminUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}

export function useToggleAdminUserStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            toggleAdminUserStatus(id, isActive),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
        },
    });
}
