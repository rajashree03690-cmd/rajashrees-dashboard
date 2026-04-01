/**
 * Settings Navigation Configuration
 * Config-driven sidebar navigation with permission-based visibility
 */

import { SettingsNavItem } from '../types/settings.types';

export const settingsNavigation: SettingsNavItem[] = [
    {
        key: 'appearance',
        label: 'Appearance',
        icon: 'Palette',
        href: '/dashboard/settings/appearance',
        permission: 'settings.appearance.view',
        description: 'Customize theme, colors, and branding',
    },
    {
        key: 'general',
        label: 'General',
        icon: 'Settings',
        href: '/dashboard/settings/general',
        permission: 'settings.general.view',
        description: 'App name, logo, timezone, and currency',
    },
    {
        key: 'company',
        label: 'Company',
        icon: 'Building',
        href: '/dashboard/settings/company',
        permission: 'settings.company.view',
        description: 'Legal details, GST, and invoice config',
    },
    {
        key: 'users',
        label: 'Admin Users',
        icon: 'Users',
        href: '/dashboard/settings/users',
        permission: 'settings.users.view',
        description: 'Manage dashboard administrators',
    },
    {
        key: 'permissions',
        label: 'Roles & Permissions',
        icon: 'Shield',
        href: '/dashboard/settings/permissions',
        permission: 'settings.permissions.view',
        description: 'Configure roles and access control',
    },
    {
        key: 'security',
        label: 'Security',
        icon: 'Lock',
        href: '/dashboard/settings/security',
        permission: 'settings.security.view',
        description: 'Password policy and session management',
    },
];
