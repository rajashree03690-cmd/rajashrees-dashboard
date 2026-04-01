'use client';

import { invoiceGenerationService } from '@/modules/invoices/services/invoice-generation.service';
import { useState, useEffect, useMemo } from 'react';
import { ordersService } from '@/modules/orders/services/orders.service';
import { shipmentsApiService } from '@/modules/shipments/services/shipments-api.service';
import { excelService } from '@/lib/services/excel.service';
import type { Order, OrderItem, SkuSummary } from '@/types/orders';
import type { Shipment } from '@/types/shipments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Search,
    FileDown,
    FileText,
    RefreshCw,
    Filter,
    X,
    ExternalLink,
    Package,
    ShoppingCart,
    DollarSign,
    CheckCircle,
    Clock,
    AlertTriangle,
    Lock,
    Eye,
    Truck,
    Download,
} from 'lucide-react';
import { format } from 'date-fns';
import GenerateInvoiceDialog from '@/modules/invoices/components/GenerateInvoiceDialog';
import InvoiceViewer from '@/modules/invoices/components/InvoiceViewer';
import { useOrdersRealtime } from '@/hooks/useOrdersRealtime';
import { RefundStatusBadge } from '@/components/refund-status-badge';
import { RefundTimeline } from '@/components/refund-timeline';
import { TrackingTimeline } from '@/components/TrackingTimeline';
import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';

export default function OrdersPage() {
    // State
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

    // Pagination
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const pageSizeOptions = [10, 20, 50, 100];

    // Filters
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const [invoiceStatus, setInvoiceStatus] = useState<'all' | 'generated' | 'pending'>('all');
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [dateFrom, setDateFrom] = useState<Date | null>(null);
    const [dateTo, setDateTo] = useState<Date | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    // Dialogs
    const [actionLoading, setActionLoading] = useState(false);
    const [orderDetailsDialog, setOrderDetailsDialog] = useState<{ open: boolean; order: Order | null }>({
        open: false,
        order: null,
    });
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [orderShipment, setOrderShipment] = useState<Shipment | null>(null);
    const [skuDialog, setSkuDialog] = useState(false);
    const [skuSummary, setSkuSummary] = useState<SkuSummary[]>([]);
    const [skuDate, setSkuDate] = useState(new Date());
    const [invoiceDialog, setInvoiceDialog] = useState(false);

    const [invoiceViewerDialog, setInvoiceViewerDialog] = useState<{ open: boolean; orderId: string | null }>({ open: false, orderId: null });
    const [trackingDialog, setTrackingDialog] = useState<{ open: boolean; orderId: string | null; data: any; loading: boolean }>({
        open: false,
        orderId: null,
        data: null,
        loading: false
    });

    // Multi-select filter dialog
    const [filterDialog, setFilterDialog] = useState<{
        open: boolean;
        type: 'status' | 'source' | null;
    }>({ open: false, type: null });

    const [partialRefundState, setPartialRefundState] = useState<{ open: boolean; amount: string }>({ open: false, amount: '' });


    // Filter options (matching actual database values)
    const filterOptions = {
        status: ['processing', 'Completed', 'failed', 'pending_payment', 'Cancelled'],
        source: ['WEB', 'WhatsApp'],  // Updated to match actual DB values
    };

    // Helper: check if an order is eligible for invoice
    function isOrderPaidAndValid(order: Order): boolean {
        const paidStatuses = ['paid', 'PAID', 'Paid'];
        const blockedOrderStatuses = ['Cancelled', 'cancelled', 'failed', 'payment_failed'];
        if (blockedOrderStatuses.includes(order.order_status)) return false;
        if (paidStatuses.includes(order.payment_status)) return true;
        // For COD orders, consider them valid
        if (order.payment_method === 'COD') return true;
        // WhatsApp orders may not go through Razorpay
        if (order.source === 'WhatsApp' && order.payment_transaction_id) return true;
        return false;
    }

    // Fetch orders on mount using Edge Function (matching Flutter)
    useEffect(() => {
        async function loadOrders() {
            setLoading(true);
            console.log('📡 Loading orders via Edge Function...');
            const result = await ordersService.fetchOrders();
            setOrders(result.orders);
            console.log(`✅ Loaded ${result.orders.length} orders (total: ${result.total})`);
            setLoading(false);
        }
        loadOrders();
    }, []);

    // Real-time updates for refund status changes
    useOrdersRealtime({
        onUpdate: (updatedOrder) => {
            setOrders(prevOrders =>
                prevOrders.map(order =>
                    order.order_id === updatedOrder.order_id
                        ? { ...order, ...updatedOrder }
                        : order
                )
            );
            // Update order details dialog if open
            if (orderDetailsDialog.order?.order_id === updatedOrder.order_id) {
                setOrderDetailsDialog(prev => ({
                    ...prev,
                    order: prev.order ? { ...prev.order, ...updatedOrder } : prev.order
                }));
            }
        },
    });

    // Calculate summary stats from filtered orders
    const orderStats = useMemo(() => {
        const total = orders.length;
        const totalSales = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        const processing = orders.filter(o => o.order_status?.toLowerCase() === 'processing').length;
        const completed = orders.filter(o => o.order_status?.toLowerCase() === 'completed').length;

        return { total, totalSales, processing, completed };
    }, [orders]);

    // Apply filters
    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const customer = order.customers;

            // Search filter
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch =
                !searchQuery ||
                (customer?.full_name?.toLowerCase().includes(searchLower)) ||
                (customer?.mobile_number?.includes(searchQuery)) ||
                order.shipping_address?.toLowerCase().includes(searchLower) ||
                order.shipping_state?.toLowerCase().includes(searchLower) ||
                order.source?.toLowerCase().includes(searchLower) ||
                order.order_id?.toLowerCase().includes(searchLower);

            // Status filter (case-insensitive)
            const matchesStatus =
                selectedStatuses.length === 0 ||
                selectedStatuses.some(s => s.toLowerCase() === order.order_status?.toLowerCase());

            // Source filter (case-insensitive)
            const matchesSource =
                selectedSources.length === 0 ||
                selectedSources.some(s => s.toLowerCase() === order.source?.toLowerCase());

            // Date filter
            const matchesDate =
                !selectedDate ||
                (order.created_at &&
                    new Date(order.created_at).toDateString() === selectedDate.toDateString());

            // Date range filter
            const matchesDateRange = (() => {
                if (!dateFrom && !dateTo) return true;
                if (!order.created_at) return false;

                const orderDate = new Date(order.created_at);
                const from = dateFrom ? new Date(dateFrom.setHours(0, 0, 0, 0)) : null;
                const to = dateTo ? new Date(dateTo.setHours(23, 59, 59, 999)) : null;

                if (from && to) return orderDate >= from && orderDate <= to;
                if (from) return orderDate >= from;
                if (to) return orderDate <= to;
                return true;
            })();

            // Month filter
            const matchesMonth = (() => {
                if (!selectedMonth) return true;
                if (!order.created_at) return false;

                const orderDate = new Date(order.created_at);
                const [year, month] = selectedMonth.split('-');
                return orderDate.getFullYear() === parseInt(year) &&
                    orderDate.getMonth() === parseInt(month) - 1;
            })();

            // Invoice Status Filter
            const matchesInvoiceStatus =
                invoiceStatus === 'all' ||
                (invoiceStatus === 'generated' && !!order.invoice_number) ||
                (invoiceStatus === 'pending' && !order.invoice_number);

            return matchesSearch && matchesStatus && matchesSource && matchesDate && matchesDateRange && matchesMonth && matchesInvoiceStatus;
        });
    }, [orders, searchQuery, selectedStatuses, selectedSources, selectedDate, dateFrom, dateTo, selectedMonth, invoiceStatus]);

    //Pagination
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
    const paginatedOrders = filteredOrders.slice(
        page * pageSize,
        (page + 1) * pageSize
    );

    // Load order details
    async function loadOrderDetails(order: Order) {
        const items = await ordersService.fetchOrderItems(order.order_id);
        const shipment = await shipmentsApiService.fetchShipmentByOrderId(order.order_id);
        setOrderItems(items);
        setOrderShipment(shipment);
        setOrderDetailsDialog({ open: true, order });
    }

    // Load SKU summary
    async function loadSkuSummary() {
        const data = await ordersService.fetchDailySkuSummary(skuDate);
        setSkuSummary(data);
        setSkuDialog(true);
    }

    // Handle row selection
    function toggleOrderSelection(orderId: string) {
        const newSelected = new Set(selectedOrderIds);
        if (newSelected.has(orderId)) {
            newSelected.delete(orderId);
        } else {
            newSelected.add(orderId);
        }
        setSelectedOrderIds(newSelected);
    }

    // Export to Excel (exports selected orders, or all filtered orders if none selected)
    function exportToExcel() {
        const ordersToExport = selectedOrderIds.size > 0
            ? orders.filter(o => selectedOrderIds.has(o.order_id))
            : filteredOrders;

        if (ordersToExport.length === 0) {
            alert('No orders to export');
            return;
        }

        const success = excelService.exportOrdersToExcel(ordersToExport);

        if (success) {
            alert(`Successfully exported ${ordersToExport.length} orders to Excel!`);
        } else {
            alert('Failed to export orders');
        }
    }

    // Download Invoices
    async function handleDownloadInvoices() {
        const ids = Array.from(selectedOrderIds);

        if (ids.length > 0) {
            // Validate: How many have invoices AND a valid URL?
            const selectedOrders = orders.filter(o => ids.includes(o.order_id));
            const ordersWithInvoices = selectedOrders.filter(o => o.invoice_number);

            // Check which ones actually have a URL
            const validOrders = ordersWithInvoices.filter(o => o.invoice_url);
            const missingUrlCount = ordersWithInvoices.length - validOrders.length;
            const notGeneratedCount = selectedOrders.length - ordersWithInvoices.length;

            if (ordersWithInvoices.length === 0) {
                alert('None of the selected orders have invoices generated. Please generate invoices first.');
                return;
            }

            if (validOrders.length === 0) {
                // Critical Fix: If we have invoice numbers but no URLs, we must tell the user to regenerate.
                // This happens if the PDF generation failed previously but the number was assigned.
                const regenerateConfirm = confirm(
                    'Selected orders have invoice numbers but are missing the PDF files (likely due to a previous error).\n\nDo you want to regenerate them now?'
                );
                if (regenerateConfirm) {
                    handleGenerateInvoices(); // Redirect to generation flow
                }
                return;
            }

            let message = '';
            // If we have a mix of valid and invalid, warn the user.
            if (missingUrlCount > 0) {
                message += `Warning: ${missingUrlCount} orders have missing PDF files and will be skipped.\n`;
            }
            if (notGeneratedCount > 0) {
                message += `Note: ${notGeneratedCount} orders do not have invoices yet and will be skipped.\n`;
            }

            if (message) {
                const proceed = confirm(
                    `${message}\nProceed with downloading ${validOrders.length} valid invoices?`
                );
                if (!proceed) return;
            } else {
                // If only downloading 1, maybe show less invasive message or just toast?
                // For now, consistent alert is fine.
                // alert('Downloading merged PDF... Please wait.'); // Commented out to reduce noise
            }

            // Show a Toast or Status instead of Alert for better UX
            console.log(`Downloading ${validOrders.length} invoices...`);
            await invoiceGenerationService.downloadInvoicesPdf({ orderIds: validOrders.map(o => o.order_id) });
        } else {
            // Bulk download by date
            if (dateFrom && dateTo) {
                if (confirm(`Download merged PDF of all invoices from ${dateFrom.toLocaleDateString()} to ${dateTo.toLocaleDateString()}?`)) {
                    console.log('Generating and merging PDF by date...');
                    await invoiceGenerationService.downloadInvoicesPdf({ dateFrom, dateTo });
                }
            } else {
                alert('Please select orders OR select a date range (From/To) to download bulk invoices.');
            }
        }
    }

    // Generate invoices — STRICT: only for paid / valid orders
    function handleGenerateInvoices() {
        if (selectedOrderIds.size === 0) {
            alert('Please select at least one order');
            return;
        }

        const selectedOrders = orders.filter(o => selectedOrderIds.has(o.order_id));
        const validOrders = selectedOrders.filter(isOrderPaidAndValid);
        const skippedOrders = selectedOrders.filter(o => !isOrderPaidAndValid(o));

        if (validOrders.length === 0) {
            alert(
                `⚠️ Cannot generate invoices.\n\nAll ${skippedOrders.length} selected order(s) have unpaid/cancelled/failed payment status.\n\nInvoices can only be generated for orders with confirmed payment.`
            );
            return;
        }

        if (skippedOrders.length > 0) {
            const skippedList = skippedOrders
                .map(o => `  • ${o.order_id} — Status: ${o.order_status}, Payment: ${o.payment_status || 'pending'}`)
                .join('\n');
            const proceed = confirm(
                `⚠️ ${skippedOrders.length} order(s) will be SKIPPED (unpaid/cancelled/failed):\n\n${skippedList}\n\nProceed with generating invoices for ${validOrders.length} valid order(s)?`
            );
            if (!proceed) return;
            // Update selection to only valid orders
            setSelectedOrderIds(new Set(validOrders.map(o => o.order_id)));
        }

        setInvoiceDialog(true);
    }

    function handleInvoiceSuccess() {
        // Reload orders to get updated invoice data
        async function reload() {
            const result = await ordersService.fetchOrders();
            setOrders(result.orders);
            setSelectedOrderIds(new Set());
        }
        reload();
    }

    function viewInvoice(orderId: string) {
        setInvoiceViewerDialog({ open: true, orderId });
    }

    // Track Shipments
    async function handleTrackOrder(orderId: string) {
        setTrackingDialog({ open: true, orderId, data: null, loading: true });

        const { data, error } = await shipmentsApiService.fetchTracking(orderId);

        if (error) {
            console.error('Tracking fetch error:', error);
            setTrackingDialog(prev => ({
                ...prev,
                loading: false,
                data: { error: 'Failed to fetch tracking info' }
            }));
        } else {
            setTrackingDialog(prev => ({
                ...prev,
                loading: false,
                data: data
            }));
        }
    }

    // Export SKU to Excel
    function exportSkuToExcel() {
        const success = excelService.exportSkuSummaryToExcel(skuSummary, skuDate);
        if (success) {
            alert('Successfully exported SKU summary to Excel!');
        } else {
            alert('Failed to export SKU summary');
        }
    }

    async function handleCancelOrder(orderId: string) {
        if (!confirm('Are you sure you want to cancel this order?')) return;
        setActionLoading(true);

        // Auto-cancel AWB on Delhivery if shipment exists
        try {
            const shipment = await shipmentsApiService.fetchShipmentByOrderId(orderId);
            if (shipment?.tracking_number && shipment?.shipping_provider === 'Delhivery') {
                const { delhiveryService } = await import('@/modules/delhivery/services/delhivery.service');
                const cancelRes = await delhiveryService.cancelShipment(shipment.tracking_number);
                if (cancelRes.success) {
                    console.log('✅ Delhivery AWB cancelled:', shipment.tracking_number);
                } else {
                    console.warn('⚠️ AWB cancel failed (may already be picked up):', cancelRes.error);
                }
            }
        } catch (e) {
            console.warn('⚠️ Could not cancel AWB on Delhivery:', e);
        }

        const success = await ordersService.cancelOrder(orderId);
        if (success) {
            alert('Order cancelled successfully');
            setOrderDetailsDialog(prev => prev.order ? { ...prev, order: { ...prev.order, order_status: 'Cancelled' } } : prev);
            // Refresh orders list
            const result = await ordersService.fetchOrders();
            setOrders(result.orders);
        } else {
            alert('Failed to cancel order');
        }
        setActionLoading(false);
    }

    async function handleInitiateRefund(orderId: string, amount: number, isPartial: boolean = false) {
        if (!confirm(`Are you sure you want to initiate a Razorpay refund of ₹${amount} for this order?`)) return;
        setActionLoading(true);

        // Auto-cancel AWB on Delhivery if shipment exists and it's a full refund/cancel
        if (!isPartial) {
            try {
                const shipment = await shipmentsApiService.fetchShipmentByOrderId(orderId);
                if (shipment?.tracking_number && shipment?.shipping_provider === 'Delhivery') {
                    const { delhiveryService } = await import('@/modules/delhivery/services/delhivery.service');
                    await delhiveryService.cancelShipment(shipment.tracking_number);
                }
            } catch (e) {
                console.warn('⚠️ Could not cancel AWB on Delhivery:', e);
            }
        }

        const { success, error, message } = await ordersService.initiateRefund(orderId, amount, 'admin', isPartial ? 'Admin partial refund' : 'Admin full cancel & refund');
        if (success) {
            alert(`✅ Razorpay refund initiated successfully!\n\n${message || 'Refund will be processed to the original payment method.'}`);
            setOrderDetailsDialog(prev => prev.order ? {
                ...prev, order: {
                    ...prev.order,
                    order_status: isPartial ? prev.order.order_status : 'Cancelled',
                    payment_status: isPartial ? 'partially_refunded' : 'refunded',
                    refund_status: isPartial ? 'partial' : 'refunded',
                    refunded_amount: (prev.order.refunded_amount || 0) + amount
                }
            } : prev);
            // Refresh orders list
            const ordersRes = await fetch(`${getSupabaseBaseUrl()}/rest/v1/orders?select=*,customers(full_name),order_items(*,product_variants(*,products(name))),shipment_tracking(*)&order=created_at.desc`, {
                headers: { 'apikey': getSupabaseAnonKey(), 'Authorization': `Bearer ${getSupabaseAnonKey()}` }
            });
            if (ordersRes.ok) setOrders(await ordersRes.json());
            setPartialRefundState({ open: false, amount: '' });
        } else {
            alert('❌ Failed to initiate refund:\n\n' + error);
        }
        setActionLoading(false);
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        Orders Management
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Manage and track all orders
                    </p>
                </div>

                <Button onClick={loadSkuSummary} variant="outline" className="gap-2">
                    <Package className="h-4 w-4" />
                    SKU Summary
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Orders</p>
                                <p className="text-2xl font-bold">{orderStats.total}</p>
                            </div>
                            <ShoppingCart className="h-8 w-8 text-indigo-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Sales</p>
                                <p className="text-2xl font-bold">₹{(orderStats.totalSales / 1000).toFixed(1)}K</p>
                            </div>
                            <DollarSign className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Processing</p>
                                <p className="text-2xl font-bold text-yellow-600">{orderStats.processing}</p>
                            </div>
                            <Clock className="h-8 w-8 text-yellow-600" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Completed</p>
                                <p className="text-2xl font-bold text-green-600">{orderStats.completed}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Actions */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Search */}
                        <div className="flex-1 min-w-[250px]">
                            <label className="text-sm font-medium mb-2 block">Search</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search by mobile, order ID, name..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(0);
                                    }}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Status</label>
                            <div className="flex gap-2 flex-wrap">
                                {selectedStatuses.map((status) => (
                                    <Badge key={status} variant="secondary" className="gap-1">
                                        {status}
                                        <X
                                            className="h-3 w-3 cursor-pointer"
                                            onClick={() => {
                                                setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                                                setPage(0);
                                            }}
                                        />
                                    </Badge>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFilterDialog({ open: true, type: 'status' })}
                                >
                                    <Filter className="h-4 w-4 mr-1" />
                                    {selectedStatuses.length === 0 ? 'Select' : 'Edit'}
                                </Button>
                            </div>
                        </div>

                        {/* Source Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Source</label>
                            <div className="flex gap-2 flex-wrap">
                                {selectedSources.map((source) => (
                                    <Badge key={source} variant="secondary" className="gap-1">
                                        {source}
                                        <X
                                            className="h-3 w-3 cursor-pointer"
                                            onClick={() => {
                                                setSelectedSources(selectedSources.filter(s => s !== source));
                                                setPage(0);
                                            }}
                                        />
                                    </Badge>
                                ))}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setFilterDialog({ open: true, type: 'source' })}
                                >
                                    <Filter className="h-4 w-4 mr-1" />
                                    {selectedSources.length === 0 ? 'Select' : 'Edit'}
                                </Button>
                            </div>
                        </div>

                        {/* Month Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Month</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => {
                                    setSelectedMonth(e.target.value);
                                    if (e.target.value) {
                                        setSelectedDate(null);  // Clear single date
                                        setDateFrom(null);       // Clear date range
                                        setDateTo(null);
                                    }
                                    setPage(0);
                                }}
                                className="border rounded px-3 py-2 w-40 text-sm"
                            >
                                <option value="">All Months</option>
                                {Array.from({ length: 12 }, (_, i) => {
                                    const date = new Date();
                                    date.setDate(1); // ✅ Set to 1st to avoid month rollover (e.g. Feb 30 -> Mar 2)
                                    date.setMonth(date.getMonth() - i);
                                    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                                    const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                                    return <option key={value} value={value}>{label}</option>;
                                })}
                            </select>
                        </div>

                        {/* Invoice Status Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">Invoice Status</label>
                            <select
                                value={invoiceStatus}
                                onChange={(e) => {
                                    setInvoiceStatus(e.target.value as any);
                                    setPage(0);
                                }}
                                className="border rounded px-3 py-2 w-40 text-sm"
                            >
                                <option value="all">All</option>
                                <option value="generated">Generated</option>
                                <option value="pending">Pending</option>
                            </select>
                        </div>

                        {/* Date Range Filter */}
                        <div>
                            <label className="text-sm font-medium mb-2 block">From Date</label>
                            <DatePicker
                                date={dateFrom || new Date()}
                                onDateChange={(date) => {
                                    setDateFrom(date);
                                    setSelectedMonth('');  // Clear month filter
                                    setSelectedDate(null); // Clear single date
                                    setPage(0);
                                }}
                            />
                            {dateFrom && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDateFrom(null)}
                                    className="ml-2"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">To Date</label>
                            <DatePicker
                                date={dateTo || new Date()}
                                onDateChange={(date) => {
                                    setDateTo(date);
                                    setSelectedMonth('');  // Clear month filter
                                    setSelectedDate(null); // Clear single date
                                    setPage(0);
                                }}
                            />
                            {dateTo && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDateTo(null)}
                                    className="ml-2"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-4 pt-4 border-t">
                        <Button onClick={handleGenerateInvoices} disabled={selectedOrderIds.size === 0}>
                            <FileText className="h-4 w-4 mr-2" />
                            Generate Invoice ({selectedOrderIds.size})
                        </Button>
                        <Button onClick={handleDownloadInvoices} variant="secondary">
                            <Download className="h-4 w-4 mr-2" />
                            Download Invoices
                        </Button>
                        <Button onClick={exportToExcel} variant="outline">
                            <FileDown className="h-4 w-4 mr-2" />
                            Export Excel ({selectedOrderIds.size > 0 ? selectedOrderIds.size : filteredOrders.length})
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setSelectedOrderIds(new Set());
                                setSearchQuery('');
                                setSelectedStatuses([]);
                                setSelectedSources([]);
                                setSelectedDate(null);
                                setDateFrom(null);
                                setDateTo(null);
                                setSelectedMonth('');
                            }}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Clear All
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
                <CardHeader>
                    <CardTitle>
                        Orders ({filteredOrders.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                        </div>
                    ) : paginatedOrders.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No orders found
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="p-3 text-left">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedOrderIds(new Set(paginatedOrders.map(o => o.order_id)));
                                                    } else {
                                                        setSelectedOrderIds(new Set());
                                                    }
                                                }}
                                                checked={paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrderIds.has(o.order_id))}
                                            />
                                        </th>
                                        <th className="p-3 text-left font-semibold">Date</th>
                                        <th className="p-3 text-left font-semibold">Order ID</th>
                                        <th className="p-3 text-left font-semibold">Customer Name</th>
                                        <th className="p-3 text-left font-semibold">Mobile</th>
                                        <th className="p-3 text-left font-semibold">Amount</th>
                                        <th className="p-3 text-left font-semibold">Source</th>
                                        <th className="p-3 text-left font-semibold">Order Status</th>
                                        <th className="p-3 text-left font-semibold">Shipment Status</th>
                                        <th className="p-3 text-left font-semibold">Invoice</th>
                                        <th className="p-3 text-left font-semibold">Payment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedOrders.map((order) => (
                                        <tr key={order.order_id} className="border-b hover:bg-gray-50 transition-colors">
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedOrderIds.has(order.order_id)}
                                                    onChange={() => toggleOrderSelection(order.order_id)}
                                                />
                                            </td>
                                            <td className="p-3 text-sm">
                                                {order.order_date ? format(new Date(order.order_date), 'yyyy-MM-dd HH:mm') :
                                                    order.created_at ? format(new Date(order.created_at), 'yyyy-MM-dd HH:mm') :
                                                        'N/A'}
                                            </td>
                                            <td className="p-3">
                                                <button
                                                    onClick={() => loadOrderDetails(order)}
                                                    className="text-blue-600 hover:underline font-medium"
                                                >
                                                    {order.order_id}
                                                </button>
                                            </td>
                                            <td className="p-3">{order.customers?.full_name || 'N/A'}</td>
                                            <td className="p-3">{order.customers?.mobile_number || order.contact_number || 'N/A'}</td>
                                            <td className="p-3 font-semibold">₹{order.total_amount.toFixed(2)}</td>
                                            <td className="p-3">
                                                <Badge variant={order.source === 'Website' ? 'default' : 'secondary'}>
                                                    {order.source}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col gap-1">
                                                    <Badge
                                                        variant={
                                                            ['Completed', 'paid'].includes(order.order_status) ? 'default' :
                                                                order.order_status === 'processing' ? 'secondary' :
                                                                    ['pending_payment', 'awaiting_payment', 'pending'].includes(order.order_status) ? 'outline' :
                                                                        'destructive'
                                                        }
                                                        className={
                                                            ['Completed', 'paid'].includes(order.order_status) ? 'bg-green-600' :
                                                                ['pending_payment', 'awaiting_payment', 'pending'].includes(order.order_status) ? 'text-yellow-600 border-yellow-500' :
                                                                    ''
                                                        }
                                                    >
                                                        {order.order_status}
                                                    </Badge>
                                                    {order.refund_status && order.refund_status !== 'none' && (
                                                        <RefundStatusBadge
                                                            status={order.refund_status as any}
                                                            amount={order.refunded_amount}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-sm ${order.shipment_status === 'Shipped' ? 'text-green-600 font-medium' : 'text-blue-600'}`}>
                                                        {order.shipment_status || 'Yet to Ship'}
                                                    </span>
                                                    {order.shipment_status && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            onClick={() => handleTrackOrder(order.order_id)}
                                                            title="Track Shipment"
                                                        >
                                                            <Truck className="h-3 w-3 text-gray-500 hover:text-indigo-600" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {order.invoice_number ? (
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="default" className="bg-green-600">
                                                            {order.invoice_number}
                                                        </Badge>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => viewInvoice(order.order_id)}
                                                            className="h-7 w-7 p-0"
                                                        >
                                                            <Eye className="h-4 w-4 text-indigo-600" />
                                                        </Button>
                                                        {order.is_locked && (
                                                            <Lock className="h-4 w-4 text-gray-400" />
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="text-gray-500">
                                                        Not Generated
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex flex-col gap-1">
                                                    {/* Payment status badge */}
                                                    <Badge
                                                        variant={
                                                            ['paid', 'PAID', 'Paid'].includes(order.payment_status)
                                                                ? 'default'
                                                                : order.payment_status === 'failed' || order.payment_status === 'cancelled'
                                                                    ? 'destructive'
                                                                    : order.payment_status === 'refunded' || order.payment_status === 'partially_refunded'
                                                                        ? 'secondary'
                                                                        : 'outline'
                                                        }
                                                        className={[
                                                            ['paid', 'PAID', 'Paid'].includes(order.payment_status) ? 'bg-green-600' : '',
                                                            order.payment_status === 'refunded' ? 'bg-orange-500 text-white' : ''
                                                        ].join(' ')}
                                                    >
                                                        {order.payment_status || 'pending'}
                                                    </Badge>
                                                    {/* Payment ID display */}
                                                    {(order.payment_transaction_id || order.transaction_id) && (
                                                        <div className="text-xs flex items-center gap-1 mt-1">
                                                            {(() => {
                                                                const txId = order.payment_transaction_id || order.transaction_id;
                                                                // Razorpay IDs usually start with 'pay_' or 'order_' but order_ shouldn't be the final payment ID.
                                                                // If it's a 'pay_' id, link to razorpay
                                                                const isRazorpay = txId.startsWith('pay_');
                                                                
                                                                if (isRazorpay) {
                                                                    return (
                                                                        <a
                                                                            href={`https://dashboard.razorpay.com/app/payments/${txId}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-blue-600 hover:underline flex items-center gap-1"
                                                                        >
                                                                            {txId.substring(0, 15)}...
                                                                            <ExternalLink className="h-3 w-3 inline" />
                                                                        </a>
                                                                    );
                                                                }
                                                                // For WhatsApp or direct UPI references
                                                                return (
                                                                    <span className="text-gray-600 font-medium">Ref: {txId}</span>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(0);
                                }}
                                className="border rounded px-2 py-1 text-sm"
                            >
                                {pageSizeOptions.map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(page - 1)}
                                disabled={page === 0}
                            >
                                Previous
                            </Button>
                            <span className="text-sm px-4">
                                Page {page + 1} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(page + 1)}
                                disabled={page >= totalPages - 1}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Order Details Dialog */}
            <Dialog open={orderDetailsDialog.open} onOpenChange={(open) => setOrderDetailsDialog({ open, order: null })}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Order {orderDetailsDialog.order?.order_id}</DialogTitle>
                    </DialogHeader>
                    {orderDetailsDialog.order && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold mb-2">Customer Information</h3>
                                <div className="text-sm space-y-1">
                                    <p><strong>Name:</strong> {orderDetailsDialog.order.customers?.full_name || 'N/A'}</p>
                                    <p><strong>Mobile:</strong> {orderDetailsDialog.order.customers?.mobile_number || 'N/A'}</p>
                                    <p><strong>Email:</strong> {orderDetailsDialog.order.customers?.email || 'N/A'}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-2">Shipping Address</h3>
                                <p className="text-sm">
                                    {orderDetailsDialog.order.name}, {orderDetailsDialog.order.shipping_address}, {orderDetailsDialog.order.shipping_state}
                                    <br />
                                    Contact: {orderDetailsDialog.order.contact_number}
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-2">Order Details</h3>
                                <div className="text-sm space-y-1">
                                    <p><strong>Amount:</strong> ₹{orderDetailsDialog.order.total_amount} (Shipping: ₹{orderDetailsDialog.order.shipping_amount})</p>
                                    <p><strong>Source:</strong> {orderDetailsDialog.order.source}</p>
                                    <p><strong>Payment:</strong> {orderDetailsDialog.order.payment_method} - {orderDetailsDialog.order.payment_transaction_id || orderDetailsDialog.order.transaction_id || 'N/A'}</p>
                                    {orderDetailsDialog.order.order_note && (
                                        <p><strong>Note:</strong> {orderDetailsDialog.order.order_note}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-2">Order Items</h3>
                                <div className="space-y-2">
                                    {orderItems.map((item, idx) => (
                                        <div key={idx} className="border rounded p-3 text-sm">
                                            <p><strong>SKU:</strong> {item.product_variants?.sku || 'N/A'}</p>
                                            <p><strong>Variant:</strong> {item.product_variants?.variant_name || 'N/A'}</p>
                                            <p><strong>Price:</strong> ₹{item.product_variants?.saleprice || 0}</p>
                                            <p><strong>Quantity:</strong> {item.quantity}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Shipment Tracking */}
                            <div>
                                <h3 className="font-semibold mb-2 flex items-center gap-2">
                                    <Truck className="h-4 w-4" />
                                    Shipment Tracking
                                </h3>
                                {orderShipment ? (
                                    <div className="border rounded p-3 text-sm space-y-1 bg-blue-50">
                                        <p><strong>Status:</strong> <Badge>{orderShipment.shipping_status || 'Yet to Ship'}</Badge></p>
                                        <p><strong>Provider:</strong> {orderShipment.shipping_provider || 'N/A'}</p>
                                        <p><strong>Tracking Number:</strong> {orderShipment.tracking_number || 'N/A'}</p>
                                        {orderShipment.tracking_url && (
                                            <p>
                                                <a
                                                    href={orderShipment.tracking_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline flex items-center gap-1"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Track Shipment
                                                </a>
                                            </p>
                                        )}
                                        {orderShipment.shipped_date && (
                                            <p><strong>Shipped:</strong> {new Date(orderShipment.shipped_date).toLocaleDateString()}</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No shipment tracking available</p>
                                )}
                            </div>

                            {orderDetailsDialog.order?.refund_status && orderDetailsDialog.order.refund_status !== 'none' && (
                                <RefundTimeline orderId={orderDetailsDialog.order.order_id} />
                            )}
                        </div>
                    )}
                    <div className="flex flex-col gap-3 mt-4 pt-4 border-t">
                        {partialRefundState.open && (
                            <div className="flex items-center gap-2 p-3 bg-gray-50 border rounded-md mb-2">
                                <span className="text-sm font-medium">Refund Amount: ₹</span>
                                <Input
                                    type="number"
                                    className="w-32"
                                    placeholder="0"
                                    value={partialRefundState.amount}
                                    onChange={(e) => setPartialRefundState(prev => ({ ...prev, amount: e.target.value }))}
                                    max={orderDetailsDialog.order?.total_amount}
                                />
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    disabled={!partialRefundState.amount || isNaN(Number(partialRefundState.amount)) || Number(partialRefundState.amount) <= 0 || Number(partialRefundState.amount) > (orderDetailsDialog.order?.total_amount || 0)}
                                    onClick={() => handleInitiateRefund(orderDetailsDialog.order!.order_id, Number(partialRefundState.amount), true)}
                                >
                                    Confirm Refund
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setPartialRefundState({ open: false, amount: '' })}>
                                    Cancel
                                </Button>
                            </div>
                        )}

                        <div className="flex justify-end gap-3">
                            {orderDetailsDialog.order && orderDetailsDialog.order.order_status !== 'Cancelled' && (
                                <Button
                                    variant="destructive"
                                    onClick={() => handleCancelOrder(orderDetailsDialog.order!.order_id)}
                                    disabled={actionLoading}
                                    title="Cancels order without auto-refunding (use for COD or manual refunds)"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel Order (No Auto-Refund)
                                </Button>
                            )}
                            {orderDetailsDialog.order &&
                                orderDetailsDialog.order.payment_transaction_id &&
                                orderDetailsDialog.order.payment_status !== 'refunded' && (
                                    <>
                                        {!partialRefundState.open && (
                                            <Button
                                                variant="outline"
                                                className="border-orange-200 text-orange-600 hover:bg-orange-50"
                                                onClick={() => setPartialRefundState({ open: true, amount: '' })}
                                                disabled={actionLoading}
                                            >
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                                Partial Refund
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            className="border-red-500 bg-red-50 text-red-700 hover:bg-red-100 font-semibold"
                                            onClick={() => handleInitiateRefund(orderDetailsDialog.order!.order_id, orderDetailsDialog.order!.total_amount, false)}
                                            disabled={actionLoading}
                                        >
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Cancel & Full Refund
                                        </Button>
                                    </>
                                )}
                            <Button variant="outline" onClick={() => {
                                setOrderDetailsDialog({ open: false, order: null });
                                setPartialRefundState({ open: false, amount: '' });
                            }}>
                                Close
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* SKU Summary Dialog */}
            <Dialog open={skuDialog} onOpenChange={setSkuDialog}>
                <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white -mx-6 -mt-6 p-6 rounded-t-lg mb-4">
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-2xl flex items-center gap-2 text-white">
                                <Package className="h-6 w-6" />
                                📦 Daily SKU Sales Summary
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                <DatePicker date={skuDate} onDateChange={setSkuDate} />
                                <Button
                                    size="sm"
                                    onClick={loadSkuSummary}
                                    variant="secondary"
                                >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Refresh
                                </Button>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={exportSkuToExcel}
                                    disabled={skuSummary.length === 0}
                                >
                                    <FileDown className="h-4 w-4 mr-1" />
                                    Export
                                </Button>
                            </div>
                        </div>
                    </DialogHeader>

                    {skuSummary.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500">No SKU summary available for this date</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Low Stock Alert */}
                            {skuSummary.filter(item => item.current_stock < 10).length > 0 && (
                                <Card className="bg-red-50 border-red-200">
                                    <CardContent className="pt-4 pb-4">
                                        <div className="flex items-center gap-2 text-red-700">
                                            <AlertTriangle className="h-5 w-5" />
                                            <p className="font-semibold">
                                                ⚠️ {skuSummary.filter(item => item.current_stock < 10).length} items with low stock (less than 10 units)!
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                                        <tr>
                                            <th className="p-3 text-left font-semibold border-b-2 border-indigo-200">SKU</th>
                                            <th className="p-3 text-left font-semibold border-b-2 border-indigo-200">Variant</th>
                                            <th className="p-3 text-right font-semibold border-b-2 border-indigo-200">Qty Sold</th>
                                            <th className="p-3 text-right font-semibold border-b-2 border-indigo-200">Current Stock</th>
                                            <th className="p-3 text-right font-semibold border-b-2 border-indigo-200">Sale Price</th>
                                            <th className="p-3 text-right font-semibold border-b-2 border-indigo-200">Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {skuSummary.map((sku, idx) => {
                                            const lowStock = sku.current_stock < 10;
                                            const revenue = sku.total_qty * sku.saleprice;

                                            return (
                                                <tr
                                                    key={idx}
                                                    className={`border-b transition-colors ${lowStock ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <td className="p-3 font-mono text-sm">{sku.sku}</td>
                                                    <td className="p-3">{sku.variant_name}</td>
                                                    <td className="p-3 text-right font-semibold">{sku.total_qty}</td>
                                                    <td className={`p-3 text-right font-semibold ${lowStock ? 'text-red-600' : 'text-green-600'}`}>
                                                        <div className="flex items-center justify-end gap-1">
                                                            {lowStock && <AlertTriangle className="h-4 w-4" />}
                                                            {sku.current_stock}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">₹{sku.saleprice.toFixed(2)}</td>
                                                    <td className="p-3 text-right font-bold text-green-700">
                                                        ₹{revenue.toFixed(2)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold border-t-2">
                                        <tr>
                                            <td colSpan={2} className="p-3">TOTAL</td>
                                            <td className="p-3 text-right">
                                                {skuSummary.reduce((sum, item) => sum + item.total_qty, 0)}
                                            </td>
                                            <td className="p-3 text-right">-</td>
                                            <td className="p-3 text-right">-</td>
                                            <td className="p-3 text-right text-green-700">
                                                ₹{skuSummary.reduce((sum, item) => sum + (item.total_qty * item.saleprice), 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Multi-Select Filter Dialog */}
            <Dialog open={filterDialog.open} onOpenChange={(open) => setFilterDialog({ open, type: null })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Select {filterDialog.type === 'status' ? 'Status' : 'Source'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        {filterDialog.type && filterOptions[filterDialog.type].map((option) => {
                            const isSelected = filterDialog.type === 'status'
                                ? selectedStatuses.includes(option)
                                : selectedSources.includes(option);

                            return (
                                <label key={option} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                            if (filterDialog.type === 'status') {
                                                if (e.target.checked) {
                                                    setSelectedStatuses([...selectedStatuses, option]);
                                                } else {
                                                    setSelectedStatuses(selectedStatuses.filter(s => s !== option));
                                                }
                                            } else {
                                                if (e.target.checked) {
                                                    setSelectedSources([...selectedSources, option]);
                                                } else {
                                                    setSelectedSources(selectedSources.filter(s => s !== option));
                                                }
                                            }
                                        }}
                                    />
                                    <span>{option}</span>
                                </label>
                            );
                        })}
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" onClick={() => setFilterDialog({ open: false, type: null })}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Generate Invoice Dialog */}
            <GenerateInvoiceDialog
                open={invoiceDialog}
                onClose={() => setInvoiceDialog(false)}
                orderIds={Array.from(selectedOrderIds)}
                onSuccess={handleInvoiceSuccess}
            />

            {/* Invoice Viewer Dialog */}
            {
                invoiceViewerDialog.orderId && (
                    <InvoiceViewer
                        open={invoiceViewerDialog.open}
                        onClose={() => setInvoiceViewerDialog({ open: false, orderId: null })}
                        orderId={invoiceViewerDialog.orderId}
                    />
                )
            }

            {/* Live Tracking Dialog */}
            <Dialog open={trackingDialog.open} onOpenChange={(open) => setTrackingDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-indigo-600" />
                            Live Shipment Status
                        </DialogTitle>
                    </DialogHeader>
                    <TrackingTimeline
                        data={trackingDialog.data}
                        loading={trackingDialog.loading}
                    />
                </DialogContent>
            </Dialog>
        </div >
    );
}
