/**
 * Settings Layout
 * Main layout with sidebar navigation for all settings pages
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { settingsNavigation } from '@/modules/settings/config/settings-navigation';
import { usePermission } from '@/hooks/use-permission';
import {
    Settings,
    Palette,
    Building,
    Users,
    Shield,
    Lock
} from 'lucide-react';

const iconMap: Record<string, any> = {
    Settings,
    Palette,
    Building,
    Users,
    Shield,
    Lock,
};

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Manage your application settings, appearance, and preferences
                    </p>
                </div>

                <div className="flex gap-8">
                    {/* Sidebar Navigation */}
                    <aside className="w-64 flex-shrink-0">
                        <nav className="space-y-1 bg-white rounded-lg shadow p-4">
                            {settingsNavigation.map((item) => (
                                <SettingsNavItem
                                    key={item.key}
                                    item={item}
                                    isActive={pathname === item.href}
                                />
                            ))}
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1">
                        <div className="bg-white rounded-lg shadow">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

function SettingsNavItem({
    item,
    isActive
}: {
    item: typeof settingsNavigation[0];
    isActive: boolean;
}) {
    const { hasPermission, loading } = usePermission(item.permission || '');

    if (loading) {
        return (
            <div className="px-3 py-2 rounded-md animate-pulse bg-gray-100" />
        );
    }

    // Don't render if no permission
    if (item.permission && !hasPermission) {
        return null;
    }

    const Icon = iconMap[item.icon] || Settings;

    return (
        <Link
            href={item.href}
            className={`
        flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
        transition-colors
        ${isActive
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }
      `}
        >
            <Icon className="w-5 h-5" />
            <span>{item.label}</span>
        </Link>
    );
}
