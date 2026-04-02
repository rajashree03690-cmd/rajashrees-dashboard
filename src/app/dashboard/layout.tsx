'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { Sidebar } from '@/components/Sidebar';
import { AppBar } from '@/components/layout/app-bar';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { user, isLoading } = useAuth();

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex flex-col flex-1 overflow-hidden ml-[70px] transition-all duration-300">
                {/* App Bar */}
                <AppBar />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto relative">
                    {/* Watermark Logo */}
                    <div
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: 'calc(50% + 35px)',
                            transform: 'translate(-50%, -50%)',
                            width: '400px',
                            height: '400px',
                            backgroundImage: 'url(/rajashree-logo.png)',
                            backgroundSize: 'contain',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center',
                            opacity: 0.10,
                            pointerEvents: 'none',
                            zIndex: 0,
                        }}
                        aria-hidden="true"
                    />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
