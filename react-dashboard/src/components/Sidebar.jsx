'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Added this import
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    ShoppingCart,
    Truck,
    RotateCcw,
    Package,
    Layers,
    Store,
    Image as ImageIcon,
    FolderTree,
    Users,
    MessageSquare,
    UserCog,
    Megaphone,
    ChevronDown,
    Sparkles,
    AlertCircle,
    ShoppingBag,
    Ticket,
    Users2,
    Settings
} from 'lucide-react';
import { useIsAdmin } from '@/hooks/useUser';

const getMenuConfig = (isAdmin) => {
    const config = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutDashboard,
            href: '/dashboard',
            type: 'single'
        },
        {
            id: 'sales',
            label: 'Sales',
            icon: ShoppingCart,
            type: 'group',
            items: [
                { label: 'Orders', href: '/dashboard/orders', icon: ShoppingCart },
                { label: 'Shipments', href: '/dashboard/shipments', icon: Truck },
                { label: 'Returns', href: '/dashboard/returns', icon: RotateCcw }
            ]
        },
        {
            id: 'catalog',
            label: 'Catalog',
            icon: Package,
            type: 'group',
            items: [
                { label: 'Products', href: '/dashboard/products', icon: Package },
                { label: 'Categories', href: '/dashboard/categories', icon: FolderTree },
                { label: 'Combos', href: '/dashboard/combos', icon: Layers },
                { label: 'Vendors', href: '/dashboard/vendors', icon: Store },
                { label: 'Purchases', href: '/dashboard/purchases', icon: ShoppingBag },
                { label: 'Banners', href: '/dashboard/banners', icon: ImageIcon }
            ]
        },
        {
            id: 'customers',
            label: 'Customers',
            icon: Users,
            type: 'group',
            items: [
                { label: 'Customers', href: '/dashboard/customers', icon: Users },
                { label: 'Queries', href: '/dashboard/queries', icon: MessageSquare },
                { label: 'Tickets', href: '/dashboard/tickets', icon: AlertCircle }
            ]
        }
    ];

    // Add System group only if admin
    if (isAdmin) {
        config.push({
            id: 'system',
            label: 'System',
            icon: UserCog,
            type: 'group',
            items: [
                { label: 'Users', href: '/dashboard/users', icon: UserCog },
                { label: 'Settings', href: '/dashboard/settings', icon: Settings },
                { label: 'Coupons', href: '/dashboard/coupons', icon: Ticket },
                { label: 'Affiliates', href: '/dashboard/affiliates', icon: Users2 },
                { label: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone }
            ]
        });
    }

    return config;
};

const MenuItem = ({ item, isActive }) => {
    const Icon = item.icon;
    const showBadge = item.badge;

    return (
        <Link
            href={item.href}
            className={`flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                ? 'bg-purple-500 shadow-lg shadow-purple-500/50 text-white'
                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="font-medium text-sm">{item.label}</span>
            </div>
            {showBadge && (
                <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${showBadge.type === 'number'
                        ? 'bg-red-500 text-white'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        }`}
                >
                    {showBadge.value}
                </span>
            )}
        </Link>
    );
};

const MenuGroup = ({ group, activeHref }) => {
    const [isOpen, setIsOpen] = useState(true);
    const Icon = group.icon;

    return (
        <div className="space-y-1">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200 group"
            >
                <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                    <span className="font-medium text-sm">{group.label}</span>
                </div>
                <ChevronDown
                    className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
                />
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="pl-4 space-y-1 border-l-2 border-white/10 ml-6">
                    {group.items.map((item) => (
                        <MenuItem
                            key={item.href}
                            item={item}
                            isActive={activeHref === item.href}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export function Sidebar() {
    const pathname = usePathname();
    const { isAdmin, loading } = useIsAdmin();
    const [isHovered, setIsHovered] = useState(false);

    if (loading) {
        return (
            <div className="w-[70px] h-screen fixed left-0 top-0 flex flex-col bg-gradient-to-br from-purple-950 via-purple-900 to-violet-950 transition-all duration-300">
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
            </div>
        );
    }

    const menuConfig = getMenuConfig(isAdmin);
    const isExpanded = isHovered;

    return (
        <div
            className={`h-screen fixed left-0 top-0 flex flex-col bg-gradient-to-br from-purple-950 via-purple-900 to-violet-950 transition-all duration-300 z-50 ${isExpanded ? 'w-[280px]' : 'w-[70px]'
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="px-4 py-8 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-xl flex-shrink-0 overflow-hidden">
                        <Image
                            src="/rajashree-logo.png"
                            alt="Rajashree Fashion Logo"
                            width={48}
                            height={48}
                            className="w-full h-full object-cover"
                            priority
                        />
                    </div>
                    {isExpanded && (
                        <div className="overflow-hidden">
                            <h1 className="text-white font-bold text-lg leading-tight whitespace-nowrap">Rajashree Fashion</h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Sparkles className="h-3 w-3 text-purple-400" />
                                <p className="text-purple-300 text-xs font-medium whitespace-nowrap">Admin Dashboard</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {menuConfig.map((menu) =>
                    menu.type === 'single' ? (
                        <Link
                            key={menu.id}
                            href={menu.href}
                            className={`flex items-center ${isExpanded ? 'justify-between' : 'justify-center'} px-4 py-3 rounded-lg transition-all duration-200 group ${pathname === menu.href
                                ? 'bg-purple-500 shadow-lg shadow-purple-500/50 text-white'
                                : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                }`}
                            title={!isExpanded ? menu.label : ''}
                        >
                            <div className="flex items-center gap-3">
                                <menu.icon className={`w-5 h-5 transition-transform flex-shrink-0 ${pathname === menu.href ? 'scale-110' : 'group-hover:scale-110'
                                    }`} />
                                {isExpanded && <span className="font-medium text-sm whitespace-nowrap">{menu.label}</span>}
                            </div>
                        </Link>
                    ) : (
                        <div key={menu.id} className="space-y-1">
                            {isExpanded ? (
                                <MenuGroup group={menu} activeHref={pathname} />
                            ) : (
                                <div className="relative group">
                                    <button className="w-full flex items-center justify-center px-4 py-3 rounded-lg text-gray-300 hover:bg-white/10 hover:text-white transition-all duration-200">
                                        <menu.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                                    </button>
                                    {/* Tooltip on hover */}
                                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap pointer-events-none">
                                        {menu.label}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                )}
            </nav>

            <div className="px-4 py-4 border-t border-white/10">
                {isExpanded ? (
                    <>
                        <p className="text-gray-400 text-xs text-center">© 2025 Rajashree Fashion</p>
                        <p className="text-gray-500 text-xs text-center mt-1 flex items-center justify-center gap-1">
                            <span>Admin Dashboard</span>
                            <span className="inline-block w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                            <span className="text-purple-400 font-medium">v2.0</span>
                        </p>
                    </>
                ) : (
                    <div className="flex justify-center">
                        <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    </div>
                )}
            </div>
        </div>
    );
}
