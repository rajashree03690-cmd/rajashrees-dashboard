/**
 * Settings Hooks
 * React Query hooks for settings CRUD with optimistic updates
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAppSettings,
    updateAppSettings,
    getCompanySettings,
    updateCompanySettings,
    getSecuritySettings,
    updateSecuritySettings,
} from '../services/settings.service';
import type {
    AppSettingsFormData,
    CompanySettingsFormData,
    SecuritySettingsFormData,
} from '../types/settings.types';

// =====================================================
// APP SETTINGS
// =====================================================

export function useAppSettings() {
    return useQuery({
        queryKey: ['app-settings'],
        queryFn: getAppSettings,
    });
}

export function useUpdateAppSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: AppSettingsFormData) => updateAppSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['app-settings'] });
        },
    });
}

// =====================================================
// COMPANY SETTINGS
// =====================================================

export function useCompanySettings() {
    return useQuery({
        queryKey: ['company-settings'],
        queryFn: getCompanySettings,
    });
}

export function useUpdateCompanySettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CompanySettingsFormData) => updateCompanySettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        },
    });
}

// =====================================================
// SECURITY SETTINGS
// =====================================================

export function useSecuritySettings() {
    return useQuery({
        queryKey: ['security-settings'],
        queryFn: getSecuritySettings,
    });
}

export function useUpdateSecuritySettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SecuritySettingsFormData) => updateSecuritySettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['security-settings'] });
        },
    });
}
