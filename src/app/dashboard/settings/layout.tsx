/**
 * Settings Layout
 * Main layout with sidebar navigation for all settings pages
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { settingsNavigation } from '@/modules/settings/config/settings-navigation';
import { useUserPermissions } from '@/hooks/use-permission';
import {
    Settings,
    Palette,
    Building,
    Users,
    Shield,
    Lock,
    ChevronRight,
    Loader2
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
    const { hasPermission, loading } = useUserPermissions();

    return (
        <div className="min-h-screen bg-[#FAFAFA]">
            <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
                {/* Header Section */}
                <div className="mb-10">
                    <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                        Settings & Preferences
                    </h1>
                    <p className="mt-2 text-base text-gray-500 max-w-2xl">
                        Manage your application configurations, team permissions, security policies, and workspace appearance from a centralized control panel.
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-10">
                    {/* Sidebar Navigation */}
                    <aside className="w-full lg:w-72 flex-shrink-0">
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3, 4, 5, 6].map((i) => (
                                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <nav className="space-y-2">
                                {settingsNavigation.map((item) => {
                                    // Hide item if user doesn't have permission
                                    if (item.permission && !hasPermission(item.permission)) {
                                        return null;
                                    }

                                    const isActive = pathname === item.href;
                                    const Icon = iconMap[item.icon] || Settings;

                                    return (
                                        <Link
                                            key={item.key}
                                            href={item.href}
                                            className={`
                                                group flex items-start gap-4 p-3 rounded-xl transition-all duration-200 ease-in-out relative overflow-hidden
                                                ${isActive
                                                    ? 'bg-white shadow-sm ring-1 ring-gray-200/50'
                                                    : 'hover:bg-gray-100/80 text-gray-600 hover:text-gray-900'
                                                }
                                            `}
                                        >
                                            {/* Active Indicator Line */}
                                            {isActive && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-600 rounded-l-xl" />
                                            )}

                                            <div className={`
                                                flex-shrink-0 mt-0.5 p-2 rounded-lg transition-colors
                                                ${isActive ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-purple-600 group-hover:shadow-sm'}
                                            `}>
                                                <Icon className="w-5 h-5" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-semibold tracking-tight ${isActive ? 'text-gray-900' : ''}`}>
                                                    {item.label}
                                                </div>
                                                <div className={`text-xs mt-0.5 line-clamp-1 ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {item.description}
                                                </div>
                                            </div>

                                            {/* Chevron indicator on hover/active */}
                                            <div className={`
                                                flex-shrink-0 self-center transition-all duration-200
                                                ${isActive ? 'opacity-100 translate-x-0 text-gray-300' : 'opacity-0 -translate-x-2 text-gray-300 group-hover:opacity-100 group-hover:translate-x-0'}
                                            `}>
                                                <ChevronRight className="w-4 h-4" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </nav>
                        )}
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 min-w-0">
                        {loading ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center justify-center min-h-[400px]">
                                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                                <p className="text-gray-500 font-medium">Verifying access permissions...</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
                                {children}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
