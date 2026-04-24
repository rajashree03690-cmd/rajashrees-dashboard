/**
 * Settings Service
 * Handles all settings CRUD operations with tenant filtering
 */

import { createClient } from '@/lib/supabase/client';
import { getTenantFilter, applyTenantFilter } from '@/lib/tenant';
import type {
    AppSettings,
    CompanySettings,
    ThemeSettings,
    SecuritySettings,
    AppSettingsFormData,
    CompanySettingsFormData,
    ThemeSettingsFormData,
    SecuritySettingsFormData,
} from '../types/settings.types';

const supabase = createClient();

// =====================================================
// APP SETTINGS
// =====================================================

export async function getAppSettings(): Promise<AppSettings | null> {
    const { data, error } = await applyTenantFilter(
        supabase.from('app_settings').select('*')
    ).single();

    if (error) {
        console.error('Error fetching app settings:', error);
        return null;
    }

    return data;
}

export async function updateAppSettings(updates: AppSettingsFormData): Promise<AppSettings | null> {
    const tenantId = getTenantFilter();

    // Check if settings exist
    const existing = await getAppSettings();

    if (existing) {
        // Update existing
        const { data, error } = await applyTenantFilter(
            supabase
                .from('app_settings')
                .update({ ...updates, updated_at: new Date().toISOString() })
        )
            .select()
            .single();

        if (error) {
            console.error('Error updating app settings:', error);
            return null;
        }

        return data;
    } else {
        // Create new
        const { data, error } = await supabase
            .from('app_settings')
            .insert({ ...updates, tenant_id: tenantId })
            .select()
            .single();

        if (error) {
            console.error('Error creating app settings:', error);
            return null;
        }

        return data;
    }
}

// =====================================================
// COMPANY SETTINGS
// =====================================================

export async function getCompanySettings(): Promise<CompanySettings | null> {
    const { data, error } = await applyTenantFilter(
        supabase.from('company_settings').select('*')
    ).single();

    if (error) {
        console.error('Error fetching company settings:', error);
        return null;
    }

    return data;
}

export async function updateCompanySettings(updates: CompanySettingsFormData): Promise<CompanySettings | null> {
    const tenantId = getTenantFilter();
    const existing = await getCompanySettings();

    if (existing) {
        const { data, error } = await applyTenantFilter(
            supabase
                .from('company_settings')
                .update({ ...updates, updated_at: new Date().toISOString() })
        )
            .select()
            .single();

        if (error) {
            console.error('Error updating company settings:', error);
            return null;
        }

        return data;
    } else {
        const { data, error } = await supabase
            .from('company_settings')
            .insert({ ...updates, tenant_id: tenantId })
            .select()
            .single();

        if (error) {
            console.error('Error creating company settings:', error);
            return null;
        }

        return data;
    }
}

// =====================================================
// SECURITY SETTINGS
// =====================================================

export async function getSecuritySettings(): Promise<SecuritySettings | null> {
    const { data, error } = await applyTenantFilter(
        supabase.from('security_settings').select('*')
    ).single();

    if (error) {
        console.error('Error fetching security settings:', error);
        return null;
    }

    return data;
}

export async function updateSecuritySettings(updates: SecuritySettingsFormData): Promise<SecuritySettings | null> {
    const tenantId = getTenantFilter();
    const existing = await getSecuritySettings();

    if (existing) {
        const { data, error } = await applyTenantFilter(
            supabase
                .from('security_settings')
                .update({ ...updates, updated_at: new Date().toISOString() })
        )
            .select()
            .single();

        if (error) {
            console.error('Error updating security settings:', error);
            return null;
        }

        return data;
    } else {
        const { data, error } = await supabase
            .from('security_settings')
            .insert({ ...updates, tenant_id: tenantId })
            .select()
            .single();

        if (error) {
            console.error('Error creating security settings:', error);
            return null;
        }

        return data;
    }
}
