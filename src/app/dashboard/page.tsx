'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ShoppingCart,
    Users,
    Package,
    DollarSign,
    TrendingUp,
    RefreshCw,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Minus
} from 'lucide-react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { DateRangeFilter, DatePreset, getPresetDates } from '@/modules/analytics/components/DateRangeFilter';
import { analyticsService, SalesAnalytics } from '@/modules/analytics/services/analytics.service';
import Link from 'next/link';
import { useIsAdmin } from '@/hooks/useUser';

interface DashboardStats {
    totalSales: number;
    orderCount: number;
    customerCount: number;
    productCount: number;
    prevTotalSales: number;
    prevOrderCount: number;
}

export default function DashboardPage() {
    const { isAdmin } = useIsAdmin();
    const defaultDates = getPresetDates('7d');
    const [dateFrom, setDateFrom] = useState<Date>(defaultDates.from);
    const [dateTo, setDateTo] = useState<Date>(defaultDates.to);

    const [stats, setStats] = useState<DashboardStats>({
        totalSales: 0,
        orderCount: 0,
        customerCount: 0,
        productCount: 0,
        prevTotalSales: 0,
        prevOrderCount: 0
    });

    const [salesData, setSalesData] = useState<SalesAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async (from: Date, to: Date) => {
        setLoading(true);
        setError(null);
        try {
            // Calculate previous period
            const diffTime = Math.abs(to.getTime() - from.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const prevTo = new Date(from);
            prevTo.setDate(prevTo.getDate() - 1);
            const prevFrom = new Date(prevTo);
            prevFrom.setDate(prevFrom.getDate() - diffDays);

            // Fetch current period data
            const [sales, products, customers, prevSales] = await Promise.all([
                analyticsService.getSalesAnalytics(from, to),
                analyticsService.getProductInsights(from, to),
                analyticsService.getCustomerAnalytics(from, to),
                analyticsService.getSalesAnalytics(prevFrom, prevTo)
            ]);

            setSalesData(sales);
            setStats({
                totalSales: sales.totalRevenue,
                orderCount: sales.totalOrders,
                customerCount: customers.totalCustomers,
                productCount: products.totalActive,
                prevTotalSales: prevSales.totalRevenue,
                prevOrderCount: prevSales.totalOrders
            });

        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(dateFrom, dateTo);
    }, []);

    const handleDateChange = (from: Date, to: Date) => {
        setDateFrom(from);
        setDateTo(to);
        loadData(from, to);
    };

    const handleRefresh = () => {
        loadData(dateFrom, dateTo);
    };

    // Calculate Trend
    const calculateTrend = (current: number, previous: number) => {
        if (previous === 0) return { val: current > 0 ? 100 : 0, isPos: current > 0 };
        const change = ((current - previous) / previous) * 100;
        return { val: Math.abs(change), isPos: change >= 0 };
    };

    const salesTrend = calculateTrend(stats.totalSales, stats.prevTotalSales);
    const ordersTrend = calculateTrend(stats.orderCount, stats.prevOrderCount);

    const statCards = [
        {
            title: 'Total Sales',
            value: `₹${stats.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            icon: DollarSign,
            trend: salesTrend,
            trendText: 'vs previous period',
            bgGradient: 'from-blue-50 to-blue-100',
            gradient: 'from-blue-500 to-blue-700',
        },
        {
            title: 'Total Orders',
            value: stats.orderCount.toLocaleString('en-IN'),
            icon: ShoppingCart,
            trend: ordersTrend,
            trendText: 'vs previous period',
            bgGradient: 'from-green-50 to-green-100',
            gradient: 'from-green-500 to-green-700',
        },
        {
            title: 'Total Customers',
            value: stats.customerCount.toLocaleString('en-IN'),
            icon: Users,
            bgGradient: 'from-purple-50 to-purple-100',
            gradient: 'from-purple-500 to-purple-700',
            trendText: 'active accounts',
            trend: { val: 0, isPos: true } // Static for now
        },
        {
            title: 'Total Products',
            value: stats.productCount.toLocaleString('en-IN'),
            icon: Package,
            bgGradient: 'from-yellow-50 to-yellow-100',
            gradient: 'from-yellow-500 to-yellow-700',
            trendText: 'in catalog',
            trend: { val: 0, isPos: true } // Static for now
        },
    ];

    return (
        <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
                    <p>{error}</p>
                    <Button variant="link" size="sm" onClick={handleRefresh} className="text-red-700 underline">
                        Retry
                    </Button>
                </div>
            )}

            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Dashboard Overview
                        </h1>
                        <p className="text-gray-600 mt-2">
                            Welcome back! Here's your business summary.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <DateRangeFilter
                            dateFrom={dateFrom}
                            dateTo={dateTo}
                            onDateChange={handleDateChange}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-2xl p-6 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {statCards.map((stat) => (
                        <Card
                            key={stat.title}
                            className={`hover:shadow-2xl transition-all duration-300 hover:scale-105 border-0 bg-gradient-to-br ${stat.bgGradient} overflow-hidden relative group`}
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-full -mr-16 -mt-16`} />
                            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                                <CardTitle className="text-sm font-medium text-gray-700">
                                    {stat.title}
                                </CardTitle>
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                                    <stat.icon className="h-5 w-5 text-white" />
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
                                <div className="mt-2 flex items-center text-sm">
                                    {stat.trend.val > 0 ? (
                                        stat.trend.isPos ? (
                                            <ArrowUpRight className="h-4 w-4 text-green-600 mr-1" />
                                        ) : (
                                            <ArrowDownRight className="h-4 w-4 text-red-600 mr-1" />
                                        )
                                    ) : (
                                        <Minus className="h-4 w-4 text-gray-400 mr-1" />
                                    )}
                                    <span className={`font-medium ${stat.trend.val > 0 ? (stat.trend.isPos ? 'text-green-600' : 'text-red-600') : 'text-gray-500'}`}>
                                        {stat.trend.val > 0 ? `${stat.trend.val.toFixed(1)}%` : ''}
                                    </span>
                                    <span className="text-gray-500 ml-1.5 text-xs">{stat.trendText}</span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Quick Links / Mini Charts */}
            {isAdmin && !loading && salesData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/dashboard/analytics/sales" className="block">
                        <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
                                        <h3 className="text-lg font-bold text-indigo-600">Analytics</h3>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                                        <TrendingUp className="h-5 w-5 text-indigo-600" />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">View detailed sales and revenue reports →</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Link href="/dashboard/analytics/products" className="block">
                        <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Products</p>
                                        <h3 className="text-lg font-bold text-emerald-600">Insights</h3>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
                                        <Package className="h-5 w-5 text-emerald-600" />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">View top sellers and stock alerts →</p>
                            </CardContent>
                        </Card>
                    </Link>
                    
                    <Link href="/dashboard/analytics/customers" className="block">
                        <Card className="border-0 shadow-md hover:shadow-lg transition-all cursor-pointer h-full">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wide">Customers</p>
                                        <h3 className="text-lg font-bold text-blue-600">Intelligence</h3>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                                        <Users className="h-5 w-5 text-blue-600" />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">View acquisition and top spenders →</p>
                            </CardContent>
                        </Card>
                    </Link>

                    <Card className="border-0 shadow-md h-full">
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Active Rate</p>
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {stats.customerCount > 0 ? ((stats.orderCount / stats.customerCount) * 100).toFixed(1) : 0}%
                                    </h3>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                                    <Users className="h-5 w-5 text-orange-600" />
                                </div>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full mt-4 overflow-hidden">
                                <div 
                                    className="h-full bg-orange-500" 
                                    style={{ width: `${Math.min((stats.orderCount / (stats.customerCount || 1)) * 100, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-2">Orders to Customers ratio</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Charts Section */}
            {!loading && salesData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales Performance - Area Chart */}
                    <Card className="border-0 shadow-xl bg-white overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
                            <CardTitle className="flex items-center gap-2 text-indigo-900">
                                <TrendingUp className="h-5 w-5 text-indigo-600" />
                                Sales Performance
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={salesData.dailyData}>
                                        <defs>
                                            <linearGradient id="colorSalesDash" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#6366F1" stopOpacity={0.05} />
                                            </linearGradient>
                                            <linearGradient id="colorOrdersDash" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#10B981" stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            stroke="#6B7280"
                                            style={{ fontSize: '12px' }}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`}
                                            stroke="#6B7280"
                                            style={{ fontSize: '12px' }}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#6B7280"
                                            style={{ fontSize: '12px' }}
                                        />
                                        <Tooltip
                                            labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                        <Area
                                            yAxisId="left"
                                            type="monotone"
                                            dataKey="revenue"
                                            name="Revenue (₹)"
                                            stroke="#6366F1"
                                            strokeWidth={3}
                                            fill="url(#colorSalesDash)"
                                        />
                                        <Area
                                            yAxisId="right"
                                            type="monotone"
                                            dataKey="orders"
                                            name="Orders"
                                            stroke="#10B981"
                                            strokeWidth={3}
                                            fill="url(#colorOrdersDash)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Order Distribution - Bar Chart */}
                    <Card className="border-0 shadow-xl bg-white overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100">
                            <CardTitle className="flex items-center gap-2 text-emerald-900">
                                <ShoppingCart className="h-5 w-5 text-green-600" />
                                Orders by Date
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={salesData.dailyData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            stroke="#6B7280"
                                            style={{ fontSize: '12px' }}
                                        />
                                        <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
                                        <Tooltip
                                            labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                            cursor={{ fill: 'rgba(16, 185, 129, 0.1)' }}
                                        />
                                        <Bar
                                            dataKey="orders"
                                            name="Orders"
                                            fill="#10B981"
                                            radius={[4, 4, 0, 0]}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
