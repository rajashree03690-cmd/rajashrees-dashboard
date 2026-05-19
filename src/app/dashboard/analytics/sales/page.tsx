'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter, DatePreset, getPresetDates } from '@/modules/analytics/components/DateRangeFilter';
import { ExportButton } from '@/modules/analytics/components/ExportButton';
import { KpiCard } from '@/modules/analytics/components/KpiCard';
import { analyticsService, SalesAnalytics } from '@/modules/analytics/services/analytics.service';
import { RefreshCw, IndianRupee, ShoppingBag, XCircle, RotateCcw } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];
const STATUS_COLORS: Record<string, string> = {
    'Processing': '#f59e0b',
    'Completed': '#10b981',
    'Cancelled': '#ef4444',
    'Pending': '#6b7280',
    'Returned': '#8b5cf6'
};

export default function SalesAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<SalesAnalytics | null>(null);

    // Default to last 30 days
    const defaultDates = getPresetDates('30d');
    const [dateFrom, setDateFrom] = useState<Date>(defaultDates.from);
    const [dateTo, setDateTo] = useState<Date>(defaultDates.to);

    useEffect(() => {
        loadData(dateFrom, dateTo);
    }, []);

    const loadData = async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const result = await analyticsService.getSalesAnalytics(from, to);
            setData(result);
        } catch (error) {
            console.error('Failed to load sales analytics', error);
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
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
                <DateRangeFilter
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateChange={handleDateChange}
                />
                
                {data && (
                    <ExportButton
                        data={data.dailyData.map(d => ({
                            Date: d.date,
                            Revenue: d.revenue,
                            Orders: d.orders
                        }))}
                        filename={`Sales_Report_${dateFrom.toISOString().split('T')[0]}_to_${dateTo.toISOString().split('T')[0]}`}
                        pdfElementId="analytics-print-area"
                    />
                )}
            </div>

            {loading && <div className="text-sm text-indigo-600 font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Updating data...</div>}

            {data && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KpiCard
                            title="Total Revenue"
                            value={`₹${data.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            icon={<IndianRupee className="h-5 w-5" />}
                            colorClass="text-indigo-600"
                        />
                        <KpiCard
                            title="Total Orders"
                            value={data.totalOrders.toLocaleString('en-IN')}
                            icon={<ShoppingBag className="h-5 w-5" />}
                            colorClass="text-blue-600"
                        />
                        <KpiCard
                            title="Avg Order Value"
                            value={`₹${data.avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            icon={<IndianRupee className="h-5 w-5" />}
                            colorClass="text-emerald-600"
                        />
                        <KpiCard
                            title="Cancellations"
                            value={data.cancelledOrders.toLocaleString('en-IN')}
                            icon={<XCircle className="h-5 w-5" />}
                            trend={data.cancellationRate}
                            trendLabel="cancellation rate"
                            colorClass="text-red-600"
                        />
                    </div>

                    {/* Charts Row 1 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Revenue Over Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                dataKey="date" 
                                                tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                stroke="#9ca3af"
                                                fontSize={12}
                                            />
                                            <YAxis 
                                                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                                stroke="#9ca3af"
                                                fontSize={12}
                                            />
                                            <RechartsTooltip 
                                                formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                            />
                                            <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Order Status Distribution</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.statusBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                dataKey="count"
                                                nameKey="status"
                                            >
                                                {data.statusBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts Row 2 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Orders by Day</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                dataKey="date" 
                                                tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                stroke="#9ca3af"
                                                fontSize={12}
                                            />
                                            <YAxis stroke="#9ca3af" fontSize={12} />
                                            <RechartsTooltip 
                                                formatter={(value: number) => [value, 'Orders']}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                                cursor={{fill: '#f3f4f6'}}
                                            />
                                            <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Revenue by Source</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={data.sourceBreakdown} margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                            <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} stroke="#9ca3af" fontSize={12} />
                                            <YAxis type="category" dataKey="source" stroke="#9ca3af" fontSize={12} />
                                            <RechartsTooltip 
                                                formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                                                cursor={{fill: '#f3f4f6'}}
                                            />
                                            <Bar dataKey="revenue" fill="#ec4899" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top Days Table */}
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Top 5 Best Performing Days</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-6 py-3">Date</th>
                                            <th className="px-6 py-3 text-right">Orders</th>
                                            <th className="px-6 py-3 text-right">Revenue</th>
                                            <th className="px-6 py-3 text-right">AOV</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.topDays.map((day, i) => (
                                            <tr key={i} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-4 text-right">{day.orders}</td>
                                                <td className="px-6 py-4 text-right font-semibold text-indigo-600">
                                                    ₹{day.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    ₹{((day.revenue / day.orders) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        ))}
                                        {data.topDays.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                    No sales data found for the selected period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
