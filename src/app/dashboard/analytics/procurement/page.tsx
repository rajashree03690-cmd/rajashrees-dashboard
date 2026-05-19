'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangeFilter, DatePreset, getPresetDates } from '@/modules/analytics/components/DateRangeFilter';
import { ExportButton } from '@/modules/analytics/components/ExportButton';
import { KpiCard } from '@/modules/analytics/components/KpiCard';
import { analyticsService, ProcurementAnalytics } from '@/modules/analytics/services/analytics.service';
import { RefreshCw, IndianRupee, Store, Wallet, CreditCard } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#10b981', '#3b82f6'];
const STATUS_COLORS: Record<string, string> = {
    'Paid': '#10b981',
    'Pending': '#f59e0b',
    'Partial': '#3b82f6'
};

export default function ProcurementAnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProcurementAnalytics | null>(null);

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
            const result = await analyticsService.getProcurementAnalytics(from, to);
            setData(result);
        } catch (error) {
            console.error('Failed to load procurement analytics', error);
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
                        data={data.outstandingList.map(o => ({
                            'Vendor': o.vendor,
                            'Invoice No': o.invoiceNo,
                            'Date': o.date,
                            'Pending Amount': o.amount
                        }))}
                        filename={`Procurement_Pending_Report_${dateFrom.toISOString().split('T')[0]}_to_${dateTo.toISOString().split('T')[0]}`}
                        pdfElementId="analytics-print-area"
                    />
                )}
            </div>

            {loading && <div className="text-sm text-indigo-600 font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" /> Updating data...</div>}

            {data && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KpiCard
                            title="Total Purchase Spend"
                            value={`₹${data.totalSpend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            icon={<IndianRupee className="h-5 w-5" />}
                            colorClass="text-indigo-600"
                        />
                        <KpiCard
                            title="Paid Amount"
                            value={`₹${data.paidAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            icon={<CreditCard className="h-5 w-5" />}
                            colorClass="text-emerald-600"
                        />
                        <KpiCard
                            title="Outstanding Amount"
                            value={`₹${data.outstandingAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                            icon={<Wallet className="h-5 w-5" />}
                            colorClass="text-amber-600"
                        />
                        <KpiCard
                            title="Active Vendors"
                            value={data.activeVendors.toLocaleString()}
                            icon={<Store className="h-5 w-5" />}
                            colorClass="text-blue-600"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2 shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Purchase Spend Over Time</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.overTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                                                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis 
                                                dataKey="month" 
                                                stroke="#9ca3af"
                                                fontSize={12}
                                            />
                                            <YAxis 
                                                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                                                stroke="#9ca3af"
                                                fontSize={12}
                                            />
                                            <RechartsTooltip 
                                                formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Spend']}
                                                labelFormatter={(label) => `Month: ${label}`}
                                            />
                                            <Area type="monotone" dataKey="amount" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorSpend)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Payment Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={data.paymentStatus}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                dataKey="amount"
                                                nameKey="status"
                                            >
                                                {data.paymentStatus.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Amount']} />
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
                                <CardTitle className="text-lg">Top Vendors by Spend</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart layout="vertical" data={data.vendorSpend.slice(0, 5)} margin={{ top: 10, right: 30, left: 60, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                            <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} stroke="#9ca3af" fontSize={12} />
                                            <YAxis type="category" dataKey="vendor" stroke="#9ca3af" fontSize={12} width={100} tickFormatter={(value) => value.substring(0, 15)} />
                                            <RechartsTooltip 
                                                formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Spend']}
                                                cursor={{fill: '#f3f4f6'}}
                                            />
                                            <Bar dataKey="amount" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg text-amber-600">Outstanding Payments List</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2">Vendor</th>
                                                <th className="px-4 py-2">Invoice No</th>
                                                <th className="px-4 py-2">Date</th>
                                                <th className="px-4 py-2 text-right">Amount Due</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.outstandingList.map((o, i) => (
                                                <tr key={i} className="border-b hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-medium text-gray-900">{o.vendor}</td>
                                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{o.invoiceNo}</td>
                                                    <td className="px-4 py-3 text-gray-500">{new Date(o.date).toLocaleDateString('en-IN')}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-amber-600">
                                                        ₹{o.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                    </td>
                                                </tr>
                                            ))}
                                            {data.outstandingList.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                                        All purchases are fully paid!
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
