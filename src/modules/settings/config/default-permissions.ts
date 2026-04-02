/**
 * Default Permissions Seed Data
 * Reference for all available permissions in the system
 */

export const DEFAULT_PERMISSIONS = {
    // Settings Module
    SETTINGS_APPEARANCE_VIEW: 'settings.appearance.view',
    SETTINGS_APPEARANCE_EDIT: 'settings.appearance.edit',
    SETTINGS_GENERAL_VIEW: 'settings.general.view',
    SETTINGS_GENERAL_EDIT: 'settings.general.edit',
    SETTINGS_COMPANY_VIEW: 'settings.company.view',
    SETTINGS_COMPANY_EDIT: 'settings.company.edit',
    SETTINGS_USERS_VIEW: 'settings.users.view',
    SETTINGS_USERS_CREATE: 'settings.users.create',
    SETTINGS_USERS_EDIT: 'settings.users.edit',
    SETTINGS_USERS_DELETE: 'settings.users.delete',
    SETTINGS_PERMISSIONS_VIEW: 'settings.permissions.view',
    SETTINGS_PERMISSIONS_EDIT: 'settings.permissions.edit',
    SETTINGS_SECURITY_VIEW: 'settings.security.view',
    SETTINGS_SECURITY_EDIT: 'settings.security.edit',

    // Dashboard Module
    DASHBOARD_VIEW: 'dashboard.view',

    // Orders Module
    ORDERS_VIEW: 'orders.view',
    ORDERS_EDIT: 'orders.edit',

    // Products Module
    PRODUCTS_VIEW: 'products.view',
    PRODUCTS_EDIT: 'products.edit',

    // Purchases Module
    PURCHASES_VIEW: 'purchases.view',
    PURCHASES_EDIT: 'purchases.edit',
} as const;

export type PermissionKey = typeof DEFAULT_PERMISSIONS[keyof typeof DEFAULT_PERMISSIONS];
