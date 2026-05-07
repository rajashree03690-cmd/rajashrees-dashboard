'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bell, Settings, User, LogOut, Shield, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DashboardUser {
    user_id: number;
    email: string;
    full_name: string | null;
    role: string;
}

export function DashboardHeader() {
    const router = useRouter();
    const [user, setUser] = useState<DashboardUser | null>(null);

    // Read actual logged-in user from localStorage
    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('dashboard_user');
            if (storedUser) {
                setUser(JSON.parse(storedUser));
            }
        } catch (err) {
            console.error('Error reading user:', err);
        }
    }, []);

    const displayName = user?.full_name || user?.email || 'User';
    const displayEmail = user?.email || '';
    const displayRole = user?.role || 'User';
    const isAdmin = user?.role === 'Admin';

    const handleLogout = () => {
        localStorage.removeItem('dashboard_user');
        router.push('/login');
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
            <div className="flex h-16 items-center justify-between px-6">
                {/* Left: Logo/Title */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-lg font-bold text-white">RF</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">Rajashree Fashions</h1>
                            <p className="text-xs text-gray-500">Admin Dashboard</p>
                        </div>
                    </div>
                </div>

                {/* Right: Actions + User */}
                <div className="flex items-center gap-3">
                    {/* Notifications */}
                    <Button variant="ghost" size="icon" className="relative">
                        <Bell className="h-5 w-5" />
                        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                            3
                        </span>
                    </Button>

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2 pl-2 pr-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-sm font-semibold">
                                        {getInitials(displayName)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start text-left">
                                    <span className="text-sm font-medium">{displayName}</span>
                                    <span className="text-xs text-gray-500 capitalize">{displayRole}</span>
                                </div>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium">{displayName}</p>
                                    <p className="text-xs text-gray-500">{displayEmail}</p>
                                    <div className="mt-2 flex items-center gap-2">
                                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                        <span className="text-xs text-gray-600">Active</span>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push('/dashboard/profile')}>
                                <User className="mr-2 h-4 w-4" />
                                Profile
                            </DropdownMenuItem>

                            {/* Admin-only controls */}
                            {isAdmin && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-xs text-gray-500">
                                        Admin Controls
                                    </DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => router.push('/dashboard/users')}>
                                        <UserCog className="mr-2 h-4 w-4" />
                                        Users Management
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => router.push('/dashboard/settings/permissions')}>
                                        <Shield className="mr-2 h-4 w-4" />
                                        Role Management
                                    </DropdownMenuItem>
                                </>
                            )}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                                <Settings className="mr-2 h-4 w-4" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
