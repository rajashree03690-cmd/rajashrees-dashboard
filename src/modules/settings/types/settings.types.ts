/**
 * Settings Module Types
 * Type definitions for all settings-related entities
 */

// =====================================================
// SETTINGS
// =====================================================

export interface AppSettings {
    id: string;
    tenant_id: string | null;
    app_name: string;
    logo_url: string | null;
    timezone: string;
    currency: string;
    maintenance_mode: boolean;
    maintenance_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface CompanySettings {
    id: string;
    tenant_id: string | null;
    legal_name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    country: string;
    gst_number: string | null;
    pan_number: string | null;
    invoice_prefix: string;
    invoice_terms: string | null;
    created_at: string;
    updated_at: string;
}

export interface ThemeSettings {
    id: string;
    tenant_id: string | null;
    theme_mode: 'light' | 'dark' | 'system';
    primary_color: string;
    secondary_color: string;
    sidebar_bg: string;
    sidebar_text: string;
    font_family: string;
    border_radius: string;
    theme_tokens: ThemeTokens | null;
    created_at: string;
    updated_at: string;
}

export interface ThemeTokens {
    [key: string]: string; // CSS variable key-value pairs
}

export interface SecuritySettings {
    id: string;
    tenant_id: string | null;
    password_min_length: number;
    password_require_uppercase: boolean;
    password_require_number: boolean;
    password_require_special: boolean;
    session_timeout_minutes: number;
    max_failed_login_attempts: number;
    lockout_duration_minutes: number;
    created_at: string;
    updated_at: string;
}

// =====================================================
// USERS & PERMISSIONS
// =====================================================

export interface Role {
    id: string;
    tenant_id: string | null;
    name: string;
    description: string | null;
    is_system: boolean;
    created_at: string;
    updated_at: string;
}

export interface Permission {
    id: string;
    key: string;
    name: string;
    description: string | null;
    category: string | null;
    created_at: string;
}

export interface RolePermission {
    role_id: string;
    permission_id: string;
    created_at: string;
}

export interface RoleWithPermissions extends Role {
    permissions: Permission[];
}

export interface AdminUser {
    id: string;
    email: string;
    full_name: string | null;
    role_id: string | null;
    role?: Role;
    is_Active: boolean;
    created_at: string;
    updated_at: string;
}

export interface UserSession {
    id: string;
    user_id: string;
    tenant_id: string | null;
    session_token: string;
    ip_address: string | null;
    user_agent: string | null;
    last_activity: string;
    expires_at: string | null;
    created_at: string;
}

// =====================================================
// FORM TYPES
// =====================================================

export interface AppSettingsFormData {
    app_name: string;
    logo_url?: string;
    timezone: string;
    currency: string;
    maintenance_mode?: boolean;
    maintenance_message?: string | null;
}

export interface CompanySettingsFormData {
    legal_name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    gst_number: string;
    pan_number: string;
    invoice_prefix: string;
    invoice_terms: string;
}

export interface ThemeSettingsFormData {
    theme_mode: 'light' | 'dark' | 'system';
    primary_color: string;
    secondary_color: string;
    sidebar_bg: string;
    sidebar_text: string;
    font_family: string;
    border_radius: string;
}

export interface SecuritySettingsFormData {
    password_min_length: number;
    password_require_uppercase: boolean;
    password_require_number: boolean;
    password_require_special: boolean;
    session_timeout_minutes: number;
    max_failed_login_attempts: number;
    lockout_duration_minutes: number;
}

export interface CreateAdminUserData {
    email: string;
    password: string;
    full_name: string;
    role_id: string;
}

export interface UpdateAdminUserData {
    email?: string;
    full_name?: string;
    role_id?: string;
    is_Active?: boolean;
}

// =====================================================
// NAVIGATION CONFIG
// =====================================================

export interface SettingsNavItem {
    key: string;
    label: string;
    icon: string;
    href: string;
    permission?: string; // Required permission to view
    description?: string;
}
