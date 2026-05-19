'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter, DatePreset, getPresetDates } from '@/modules/analytics/components/DateRangeFilter';
import { ExportButton } from '@/modules/analytics/components/ExportButton';
import { KpiCard } from '@/modules/analytics/components/KpiCard';
import { analyticsService, ReturnsAnalytics } from '@/modules/analytics/services/analytics.service';
import { RefreshCw, RotateCcw, AlertTriangle, Clock, IndianRupee } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#10b981', '#3b82f6'];

export default function ReturnsAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ReturnsAnalytics | null>(null);

    const defaultDates = getPresetDates('30d');
    const [dateFrom, setDateFrom] = useState<Date>(defaultDates.from);
    const [dateTo, setDateTo] = useState<Date>(defaultDates.to);

    useEffect(() => {
        loadData(dateFrom, dateTo);
    }, []);

    const loadData = async (from: Date, to: Date) => {
        setLoading(true);
        try {
            const result = await analyticsService.getReturnsAnalytics(from, to);
            setData(result);
        } catch (error) {
            console.error('Failed to load returns analytics', error);
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
                        data={data.topReasons.map(r => ({
                            'Return Reason': r.reason,
                            'Count': r.count
                        }))}
                        filename={`Returns_Report_${dateFrom.toISOString().split('T')[0]}_to_${dateTo.toISOString().split('T')[0]}`}
                        pdfElementId="analytics-print-area"
                    />
                )}
            </div>

            {loading && <div className="text-sm text-indigo-600 font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Updating data...</div>}

            {data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KpiCard
                            title="Total Returns"
                            value={data.totalReturns.toLocaleString()}
                            icon={<RotateCcw className="h-5 w-5" />}
                            colorClass="text-indigo-600"
                        />
                        <KpiCard
                            title="Return Rate"
                            value={`${data.returnRate.toFixed(1)}%`}
                            icon={<AlertTriangle className="h-5 w-5" />}
                            colorClass="text-orange-600"
                        />
                        <KpiCard
                            title="Refund Amount"
                            value={`₹${data.totalRefundAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            icon={<IndianRupee className="h-5 w-5" />}
                            colorClass="text-red-600"
                        />
                        <KpiCard
                            title="Pending Returns"
                            value={data.pendingReturns.toLocaleString()}
                            icon={<Clock className="h-5 w-5" />}
                            colorClass="text-amber-600"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Returns Volume Over Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.overTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
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
                                                formatter={(value: number) => [value, 'Returns']}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                            />
                                            <Area type="monotone" dataKey="count" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorRet)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Return Status</CardTitle>
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

                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg text-red-600">Top Return Reasons</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={data.topReasons} margin={{ top: 10, right: 30, left: 100, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                        <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                                        <YAxis type="category" dataKey="reason" stroke="#9ca3af" fontSize={12} width={140} tickFormatter={(value) => value.substring(0, 20)} />
                                        <RechartsTooltip 
                                            formatter={(value: number) => [value, 'Returns']}
                                            cursor={{fill: '#f3f4f6'}}
                                        />
                                        <Bar dataKey="count" fill="#f43f5e" radius={[0, 4, 4, 0]} />
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
