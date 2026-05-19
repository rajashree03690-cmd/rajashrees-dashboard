'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter, DatePreset, getPresetDates } from '@/modules/analytics/components/DateRangeFilter';
import { ExportButton } from '@/modules/analytics/components/ExportButton';
import { KpiCard } from '@/modules/analytics/components/KpiCard';
import { analyticsService, CustomerAnalytics } from '@/modules/analytics/services/analytics.service';
import { RefreshCw, Users, UserPlus, Repeat, Star } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];

export default function CustomerIntelligencePage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<CustomerAnalytics | null>(null);

    const defaultDates = getPresetDates('30d');
    const [dateFrom, setDateFrom] = useState<Date>(defaultDates.from);
    const [dateTo, setDateTo] = useState<Date>(defaultDates.to);

    useEffect(() => {
        loadData(dateFrom, dateTo);
    }, []);

    const loadData = async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const result = await analyticsService.getCustomerAnalytics(from, to);
            setData(result);
        } catch (error) {
            console.error('Failed to load customer analytics', error);
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
                        data={data.topBySpend.map(c => ({
                            'Customer Name': c.name,
                            'Mobile': c.mobile,
                            'Total Orders': c.orderCount,
                            'Lifetime Spend': c.totalSpend
                        }))}
                        filename={`Customer_Intelligence_${dateFrom.toISOString().split('T')[0]}_to_${dateTo.toISOString().split('T')[0]}`}
                        pdfElementId="analytics-print-area"
                    />
                )}
            </div>

            {loading && <div className="text-sm text-indigo-600 font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Updating data...</div>}

            {data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KpiCard
                            title="Total Customers"
                            value={data.totalCustomers.toLocaleString()}
                            icon={<Users className="h-5 w-5" />}
                            colorClass="text-indigo-600"
                        />
                        <KpiCard
                            title="New This Month"
                            value={data.newThisMonth.toLocaleString()}
                            icon={<UserPlus className="h-5 w-5" />}
                            colorClass="text-emerald-600"
                        />
                        <KpiCard
                            title="Repeat Customer Rate"
                            value={`${data.repeatRate.toFixed(1)}%`}
                            icon={<Repeat className="h-5 w-5" />}
                            colorClass="text-blue-600"
                        />
                        <KpiCard
                            title="Avg Lifetime Value"
                            value={`₹${data.avgLifetimeValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            icon={<Star className="h-5 w-5" />}
                            colorClass="text-amber-600"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">New Customer Acquisitions Over Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.newOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorCust" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                dataKey="date" 
                                                tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                                stroke="#9ca3af"
                                                fontSize={12}
                                            />
                                            <YAxis stroke="#9ca3af" fontSize={12} />
                                            <RechartsTooltip 
                                                formatter={(value: number) => [value, 'New Customers']}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                            />
                                            <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCust)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Order Source Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.sourceBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                dataKey="count"
                                                nameKey="source"
                                            >
                                                {data.sourceBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Star className="h-5 w-5 text-amber-500" />
                                    Top 10 High-Value Customers (By Spend)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-4 py-2">Customer</th>
                                                <th className="px-4 py-2 text-right">Orders</th>
                                                <th className="px-4 py-2 text-right">Total Spend</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.topBySpend.map((c, i) => (
                                                <tr key={i} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-gray-900">{c.name}</p>
                                                        <p className="text-xs text-gray-500">{c.mobile}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">{c.orderCount}</td>
                                                    <td className="px-4 py-3 text-right text-indigo-600 font-semibold">
                                                        ₹{c.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Repeat className="h-5 w-5 text-blue-500" />
                                    Top 10 Highly Ordered Customers
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                            <tr>
                                                <th className="px-4 py-2">Customer</th>
                                                <th className="px-4 py-2 text-right">Total Spend</th>
                                                <th className="px-4 py-2 text-right">Orders</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.topByOrders.map((c, i) => (
                                                <tr key={i} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-gray-900">{c.name}</p>
                                                        <p className="text-xs text-gray-500">{c.mobile}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-500">
                                                        ₹{c.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                                                        {c.orderCount}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Customer Distribution by State</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.byState} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis 
                                            dataKey="state" 
                                            stroke="#9ca3af"
                                            fontSize={12}
                                            tickFormatter={(value) => value.substring(0, 10)}
                                        />
                                        <YAxis stroke="#9ca3af" fontSize={12} />
                                        <RechartsTooltip 
                                            formatter={(value: number) => [value, 'Customers']}
                                            cursor={{fill: '#f3f4f6'}}
                                        />
                                        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
