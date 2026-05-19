'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter, DatePreset, getPresetDates } from '@/modules/analytics/components/DateRangeFilter';
import { ExportButton } from '@/modules/analytics/components/ExportButton';
import { KpiCard } from '@/modules/analytics/components/KpiCard';
import { analyticsService, ProductInsights } from '@/modules/analytics/services/analytics.service';
import { RefreshCw, Package, AlertTriangle, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];
const STOCK_COLORS: Record<string, string> = {
    'Out of Stock': '#ef4444',
    'Low (1-5)': '#f59e0b',
    'Moderate (6-20)': '#3b82f6',
    'Healthy (20+)': '#10b981'
};

export default function ProductInsightsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProductInsights | null>(null);

    const defaultDates = getPresetDates('30d');
    const [dateFrom, setDateFrom] = useState<Date>(defaultDates.from);
    const [dateTo, setDateTo] = useState<Date>(defaultDates.to);

    useEffect(() => {
        loadData(dateFrom, dateTo);
    }, []);

    const loadData = async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const result = await analyticsService.getProductInsights(from, to);
            setData(result);
        } catch (error) {
            console.error('Failed to load product insights', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (from: Date, to: Date) => {
        setDateFrom(from);
        setDateTo(to);
        loadData(from, to);
    };

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center py-24">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <DateRangeFilter
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateChange={handleDateChange}
                />
                
                {data && (
                    <ExportButton
                        data={data.topSellers.map(s => ({
                            'Product Name': s.name,
                            'SKU': s.sku,
                            'Quantity Sold': s.qty,
                            'Revenue Generated': s.revenue
                        }))}
                        filename={`Product_Insights_${dateFrom.toISOString().split('T')[0]}_to_${dateTo.toISOString().split('T')[0]}`}
                        pdfElementId="analytics-print-area"
                    />
                )}
            </div>

            {loading && <div className="text-sm text-indigo-600 font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Updating data...</div>}

            {data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KpiCard
                            title="Active Products"
                            value={data.totalActive.toLocaleString()}
                            icon={<Package className="h-5 w-5" />}
                            colorClass="text-indigo-600"
                        />
                        <KpiCard
                            title="Out of Stock"
                            value={data.outOfStock.toLocaleString()}
                            icon={<AlertCircle className="h-5 w-5" />}
                            colorClass="text-red-600"
                        />
                        <KpiCard
                            title="Low Stock Alerts"
                            value={data.lowStock.toLocaleString()}
                            icon={<AlertTriangle className="h-5 w-5" />}
                            colorClass="text-orange-600"
                        />
                        <KpiCard
                            title="Avg Sale Price"
                            value={`₹${data.avgSalePrice.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            icon={<TrendingUp className="h-5 w-5" />}
                            colorClass="text-emerald-600"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                                    Top 10 Selling Products
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={data.topSellers} margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                            <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                                            <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={120} tickFormatter={(value) => value.substring(0, 15) + (value.length > 15 ? '...' : '')} />
                                            <RechartsTooltip 
                                                formatter={(value: number) => [value, 'Units Sold']}
                                                cursor={{fill: '#f3f4f6'}}
                                            />
                                            <Bar dataKey="qty" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <TrendingDown className="h-5 w-5 text-red-500" />
                                    Bottom 10 Selling Products
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={data.bottomSellers} margin={{ top: 10, right: 30, left: 80, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                            <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                                            <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} width={120} tickFormatter={(value) => value.substring(0, 15) + (value.length > 15 ? '...' : '')} />
                                            <RechartsTooltip 
                                                formatter={(value: number) => [value, 'Units Sold']}
                                                cursor={{fill: '#f3f4f6'}}
                                            />
                                            <Bar dataKey="qty" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Stock Health Overview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.stockHealth}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                dataKey="count"
                                                nameKey="status"
                                            >
                                                {data.stockHealth.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={STOCK_COLORS[entry.status] || COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Top 5 Products Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-4 py-2">Product Name</th>
                                                <th className="px-4 py-2">SKU</th>
                                                <th className="px-4 py-2 text-right">Units</th>
                                                <th className="px-4 py-2 text-right">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.topSellers.slice(0, 5).map((product, i) => (
                                                <tr key={i} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate" title={product.name}>
                                                        {product.name}
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">{product.sku}</td>
                                                    <td className="px-4 py-3 text-right font-medium">{product.qty}</td>
                                                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                                                        ₹{product.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                    </td>
                                                </tr>
                                            ))}
                                            {data.topSellers.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                                        No product data found for the selected period.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
}
