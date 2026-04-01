/**
 * Theme Service
 * Handles theme CRUD, token generation, and live preview
 */

import { createClient } from '@/lib/supabase/client';
import { getTenantFilter } from '@/lib/tenant';
import type {
    ThemeSettings,
    ThemeSettingsFormData,
    ThemeTokens,
} from '../types/settings.types';

const supabase = createClient();

// =====================================================
// THEME CRUD
// =====================================================

export async function getThemeSettings(): Promise<ThemeSettings | null> {
    const { data, error } = await supabase
        .from('theme_settings')
        .select('*')
        .eq('tenant_id', getTenantFilter())
        .single();

    if (error) {
        console.error('Error fetching theme settings:', error);
        return null;
    }

    return data;
}

export async function updateThemeSettings(updates: ThemeSettingsFormData): Promise<ThemeSettings | null> {
    const tenantId = getTenantFilter();
    const existing = await getThemeSettings();

    // Generate theme tokens from form data
    const tokens = generateThemeTokens(updates);

    if (existing) {
        const { data, error } = await supabase
            .from('theme_settings')
            .update({
                ...updates,
                theme_tokens: tokens,
                updated_at: new Date().toISOString()
            })
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (error) {
            console.error('Error updating theme settings:', error);
            return null;
        }

        return data;
    } else {
        const { data, error } = await supabase
            .from('theme_settings')
            .insert({
                ...updates,
                theme_tokens: tokens,
                tenant_id: tenantId
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating theme settings:', error);
            return null;
        }

        return data;
    }
}

// =====================================================
// THEME TOKEN GENERATION
// =====================================================

export function generateThemeTokens(settings: ThemeSettingsFormData): ThemeTokens {
    return {
        '--color-primary': settings.primary_color,
        '--color-secondary': settings.secondary_color,
        '--sidebar-bg': settings.sidebar_bg,
        '--sidebar-text': settings.sidebar_text,
        '--font-family': settings.font_family,
        '--border-radius': settings.border_radius,
        '--theme-mode': settings.theme_mode,
    };
}

// =====================================================
// LIVE THEME APPLICATION
// =====================================================

export function applyTheme(theme: ThemeSettings): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    // Apply theme tokens
    if (theme.theme_tokens) {
        Object.entries(theme.theme_tokens).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
    } else {
        // Fallback to individual properties
        root.style.setProperty('--color-primary', theme.primary_color);
        root.style.setProperty('--color-secondary', theme.secondary_color);
        root.style.setProperty('--sidebar-bg', theme.sidebar_bg);
        root.style.setProperty('--sidebar-text', theme.sidebar_text);
        root.style.setProperty('--font-family', theme.font_family);
        root.style.setProperty('--border-radius', theme.border_radius);
    }

    // Apply theme mode
    applyThemeMode(theme.theme_mode);
}

export function applyThemeMode(mode: 'light' | 'dark' | 'system'): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;

    if (mode === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
    } else {
        root.classList.toggle('dark', mode === 'dark');
    }
}

// =====================================================
// THEME PREVIEW (without saving)
// =====================================================

export function previewTheme(formData: ThemeSettingsFormData): void {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const tokens = generateThemeTokens(formData);

    Object.entries(tokens).forEach(([key, value]) => {
        root.style.setProperty(key, value);
    });

    applyThemeMode(formData.theme_mode);
}

// =====================================================
// SYSTEM PREFERENCE LISTENER
// =====================================================

export function watchSystemTheme(callback: (isDark: boolean) => void): () => void {
    if (typeof window === 'undefined') return () => { };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handler = (e: MediaQueryListEvent) => {
        callback(e.matches);
    };

    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
}
