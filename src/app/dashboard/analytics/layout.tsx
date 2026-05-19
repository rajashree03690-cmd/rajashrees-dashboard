'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useIsAdmin } from '@/hooks/useUser';

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { isAdmin, loading } = useIsAdmin();

    if (loading) {
        return <div className="p-6">Loading Analytics...</div>;
    }

    // Ensure only Admin can view analytics
    if (!isAdmin) {
        return (
            <div className="p-6 text-center text-red-600 font-semibold">
                Access Denied: You do not have permission to view Analytics & Reports.
            </div>
        );
    }

    const tabs = [
        { name: 'Sales Performance', path: '/dashboard/analytics/sales' },
        { name: 'Product Insights', path: '/dashboard/analytics/products' },
        { name: 'Customer Intelligence', path: '/dashboard/analytics/customers' },
        { name: 'Shipping & Delivery', path: '/dashboard/analytics/shipping' },
        { name: 'Procurement', path: '/dashboard/analytics/procurement' },
        { name: 'Returns & Refunds', path: '/dashboard/analytics/returns' },
    ];

    return (
        <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen print:bg-white print:p-0">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 print:hidden">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Analytics & Reports
                </h1>
                <p className="text-gray-600 mt-2">
                    Enterprise intelligence and performance tracking across all operations.
                </p>

                {/* Sub-navigation tabs */}
                <div className="flex flex-wrap gap-2 mt-6 border-b pb-1">
                    {tabs.map(tab => (
                        <Link key={tab.path} href={tab.path}>
                            <span
                                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors inline-block ${
                                    pathname === tab.path
                                        ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                {tab.name}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Page Content */}
            <div id="analytics-print-area">
                {children}
            </div>
        </div>
    );
}
