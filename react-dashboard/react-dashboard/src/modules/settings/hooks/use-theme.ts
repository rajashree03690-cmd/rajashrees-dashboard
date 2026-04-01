/**
 * Theme Hooks
 * React Query hooks and effects for theme management
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
    getThemeSettings,
    updateThemeSettings,
    applyTheme,
    watchSystemTheme,
} from '../services/theme.service';
import type { ThemeSettingsFormData } from '../types/settings.types';

// =====================================================
// THEME SETTINGS
// =====================================================

export function useThemeSettings() {
    return useQuery({
        queryKey: ['theme-settings'],
        queryFn: getThemeSettings,
    });
}

export function useUpdateThemeSettings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: ThemeSettingsFormData) => updateThemeSettings(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['theme-settings'] });
            // Apply theme immediately
            if (data) {
                applyTheme(data);
            }
        },
    });
}

// =====================================================
// THEME APPLICATION
// =====================================================

export function useApplyTheme() {
    const { data: theme } = useThemeSettings();

    useEffect(() => {
        if (theme) {
            applyTheme(theme);
        }
    }, [theme]);

    // Watch for system theme changes if mode is 'system'
    useEffect(() => {
        if (theme?.theme_mode === 'system') {
            const unsubscribe = watchSystemTheme((isDark) => {
                document.documentElement.classList.toggle('dark', isDark);
            });

            return unsubscribe;
        }
    }, [theme?.theme_mode]);
}
