'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter, DatePreset, getPresetDates } from '@/modules/analytics/components/DateRangeFilter';
import { ExportButton } from '@/modules/analytics/components/ExportButton';
import { KpiCard } from '@/modules/analytics/components/KpiCard';
import { analyticsService, ShippingAnalytics } from '@/modules/analytics/services/analytics.service';
import { RefreshCw, Truck, CheckCircle, PackageSearch, XCircle } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316'];
const STATUS_COLORS: Record<string, string> = {
    'Delivered': '#10b981',
    'delivered': '#10b981',
    'In Transit': '#3b82f6',
    'in_transit': '#3b82f6',
    'In-Transit': '#3b82f6',
    'Pending': '#f59e0b',
    'RTO': '#ef4444',
    'rto': '#ef4444',
    'Cancelled': '#6b7280'
};

export default function ShippingAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ShippingAnalytics | null>(null);

    const defaultDates = getPresetDates('30d');
    const [dateFrom, setDateFrom] = useState<Date>(defaultDates.from);
    const [dateTo, setDateTo] = useState<Date>(defaultDates.to);

    useEffect(() => {
        loadData(dateFrom, dateTo);
    }, []);

    const loadData = async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const result = await analyticsService.getShippingAnalytics(from, to);
            setData(result);
        } catch (error) {
            console.error('Failed to load shipping analytics', error);
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
                        data={data.byState.map(s => ({
                            'State': s.state,
                            'Shipments': s.count
                        }))}
                        filename={`Shipping_Report_${dateFrom.toISOString().split('T')[0]}_to_${dateTo.toISOString().split('T')[0]}`}
                        pdfElementId="analytics-print-area"
                    />
                )}
            </div>

            {loading && <div className="text-sm text-indigo-600 font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Updating data...</div>}

            {data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KpiCard
                            title="Total Shipments"
                            value={data.totalShipments.toLocaleString()}
                            icon={<Truck className="h-5 w-5" />}
                            colorClass="text-indigo-600"
                        />
                        <KpiCard
                            title="Delivered"
                            value={`${data.deliveredPct.toFixed(1)}%`}
                            icon={<CheckCircle className="h-5 w-5" />}
                            colorClass="text-emerald-600"
                        />
                        <KpiCard
                            title="In Transit"
                            value={data.inTransitCount.toLocaleString()}
                            icon={<PackageSearch className="h-5 w-5" />}
                            colorClass="text-blue-600"
                        />
                        <KpiCard
                            title="RTO / Exceptions"
                            value={data.rtoCount.toLocaleString()}
                            icon={<XCircle className="h-5 w-5" />}
                            colorClass="text-red-600"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Shipments Created Over Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.overTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorShip" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
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
                                                formatter={(value: number) => [value, 'Shipments']}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                            />
                                            <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorShip)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Shipment Status</CardTitle>
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

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Top 10 Destination States</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.byState} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis 
                                            dataKey="state" 
                                            stroke="#9ca3af"
                                            fontSize={12}
                                            tickFormatter={(value) => value.substring(0, 15)}
                                        />
                                        <YAxis stroke="#9ca3af" fontSize={12} />
                                        <RechartsTooltip 
                                            formatter={(value: number) => [value, 'Shipments']}
                                            cursor={{fill: '#f3f4f6'}}
                                        />
                                        <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
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
