import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────
export interface SalesAnalytics {
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    cancelledOrders: number;
    cancellationRate: number;
    refundAmount: number;
    dailyData: { date: string; revenue: number; orders: number }[];
    statusBreakdown: { status: string; count: number }[];
    sourceBreakdown: { source: string; revenue: number; orders: number }[];
    topDays: { date: string; revenue: number; orders: number }[];
}

export interface ProductInsights {
    totalActive: number;
    outOfStock: number;
    lowStock: number;
    avgSalePrice: number;
    topSellers: { name: string; sku: string; qty: number; revenue: number }[];
    bottomSellers: { name: string; sku: string; qty: number }[];
    categoryRevenue: { category: string; revenue: number; orders: number }[];
    stockHealth: { status: string; count: number }[];
    outOfStockItems?: { name: string; sku: string; stock: number }[];
    lowStockItems?: { name: string; sku: string; stock: number }[];
}

export interface CustomerAnalytics {
    totalCustomers: number;
    newThisMonth: number;
    repeatRate: number;
    avgLifetimeValue: number;
    topByOrders: { name: string; mobile: string; orderCount: number; totalSpend: number }[];
    topBySpend: { name: string; mobile: string; orderCount: number; totalSpend: number }[];
    byState: { state: string; count: number }[];
    newOverTime: { date: string; count: number }[];
    sourceBreakdown: { source: string; count: number }[];
}

export interface ShippingAnalytics {
    totalShipments: number;
    deliveredCount: number;
    deliveredPct: number;
    inTransitCount: number;
    rtoCount: number;
    statusBreakdown: { status: string; count: number }[];
    byState: { state: string; count: number }[];
    overTime: { date: string; count: number }[];
}

export interface ProcurementAnalytics {
    totalSpend: number;
    paidAmount: number;
    outstandingAmount: number;
    activeVendors: number;
    vendorSpend: { vendor: string; amount: number; count: number }[];
    paymentStatus: { status: string; count: number; amount: number }[];
    overTime: { month: string; amount: number }[];
    outstandingList: { vendor: string; invoiceNo: string; amount: number; date: string }[];
}

export interface ReturnsAnalytics {
    totalReturns: number;
    returnRate: number;
    totalRefundAmount: number;
    avgRefund: number;
    pendingReturns: number;
    statusBreakdown: { status: string; count: number }[];
    topReasons: { reason: string; count: number }[];
    overTime: { date: string; count: number; refundAmount: number }[];
}

// ─── Helper ─────────────────────────────────────────────
function toDateStr(d: Date) {
    return d.toISOString().split('T')[0];
}

// ─── Service ────────────────────────────────────────────
export const analyticsService = {

    // ──────────────── SALES ────────────────
    async getSalesAnalytics(from: Date, to: Date): Promise<SalesAnalytics> {
        const fromStr = toDateStr(from);
        const toStr = toDateStr(to);

        const { data: orders, error } = await supabase
            .from('orders')
            .select('order_id, created_at, total_amount, order_status, source, payment_status, refunded_amount')
            .gte('created_at', `${fromStr}T00:00:00`)
            .lte('created_at', `${toStr}T23:59:59`)
            .order('created_at', { ascending: true });

        if (error) throw error;
        const rows = orders || [];

        const totalRevenue = rows.reduce((s, o) => s + (o.total_amount || 0), 0);
        const totalOrders = rows.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const cancelledOrders = rows.filter(o => o.order_status?.toLowerCase() === 'cancelled').length;
        const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
        const refundAmount = rows.reduce((s, o) => s + (o.refunded_amount || 0), 0);

        // Daily aggregation
        const dayMap = new Map<string, { revenue: number; orders: number }>();
        rows.forEach(o => {
            const d = o.created_at?.split('T')[0] || '';
            if (!dayMap.has(d)) dayMap.set(d, { revenue: 0, orders: 0 });
            const entry = dayMap.get(d)!;
            entry.revenue += o.total_amount || 0;
            entry.orders += 1;
        });
        const dailyData = Array.from(dayMap.entries())
            .map(([date, v]) => ({ date, ...v }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Status breakdown
        const statusMap = new Map<string, number>();
        rows.forEach(o => {
            const s = o.order_status || 'Unknown';
            statusMap.set(s, (statusMap.get(s) || 0) + 1);
        });
        const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

        // Source breakdown
        const srcMap = new Map<string, { revenue: number; orders: number }>();
        rows.forEach(o => {
            const s = o.source || 'Unknown';
            if (!srcMap.has(s)) srcMap.set(s, { revenue: 0, orders: 0 });
            const entry = srcMap.get(s)!;
            entry.revenue += o.total_amount || 0;
            entry.orders += 1;
        });
        const sourceBreakdown = Array.from(srcMap.entries()).map(([source, v]) => ({ source, ...v }));

        // Top days by revenue
        const topDays = [...dailyData].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

        return {
            totalRevenue, totalOrders, avgOrderValue, cancelledOrders,
            cancellationRate, refundAmount, dailyData, statusBreakdown,
            sourceBreakdown, topDays
        };
    },

    // ──────────────── PRODUCTS ────────────────
    async getProductInsights(from: Date, to: Date): Promise<ProductInsights> {
        // 1. Product stock health
        const { data: variants } = await supabase
            .from('product_variants')
            .select('variant_id, variant_name, sku, stock, saleprice, is_Active, product_id')
            .eq('is_Active', true);

        const allVariants = variants || [];
        const outOfStockItems = allVariants.filter(v => (v.stock || 0) <= 0).map(v => ({ name: v.variant_name || 'Unknown', sku: v.sku || '', stock: v.stock || 0 }));
        const lowStockItems = allVariants.filter(v => (v.stock || 0) > 0 && (v.stock || 0) < 5).map(v => ({ name: v.variant_name || 'Unknown', sku: v.sku || '', stock: v.stock || 0 }));
        
        const outOfStock = outOfStockItems.length;
        const lowStock = lowStockItems.length;
        const avgSalePrice = allVariants.length > 0
            ? allVariants.reduce((s, v) => s + (v.saleprice || 0), 0) / allVariants.length
            : 0;

        const { count: totalActive } = await supabase
            .from('master_product')
            .select('product_id', { count: 'exact', head: true })
            .eq('is_Active', true);

        // 2. Top/Bottom sellers from order_items in the period
        const fromStr = toDateStr(from);
        const toStr = toDateStr(to);

        const { data: orderItems } = await supabase
            .from('order_items')
            .select('catalogue_product_id, quantity, price, orders!inner(created_at, order_status), product_variants(sku, variant_name, master_product(name))')
            .gte('orders.created_at', `${fromStr}T00:00:00`)
            .lte('orders.created_at', `${toStr}T23:59:59`)
            .neq('orders.order_status', 'Cancelled');

        const skuMap = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
        (orderItems || []).forEach((item: any) => {
            const sku = item.product_variants?.sku || item.catalogue_product_id;
            const name = item.product_variants?.master_product?.name || item.product_variants?.variant_name || 'Unknown';
            const price = item.price || 0;
            if (!skuMap.has(sku)) skuMap.set(sku, { name, sku, qty: 0, revenue: 0 });
            const entry = skuMap.get(sku)!;
            entry.qty += item.quantity || 0;
            entry.revenue += (item.quantity || 0) * price;
        });

        const sorted = Array.from(skuMap.values()).sort((a, b) => b.qty - a.qty);
        const topSellers = sorted.slice(0, 10);
        const bottomSellers = sorted.length > 10
            ? sorted.slice(-10).reverse().map(({ name, sku, qty }) => ({ name, sku, qty }))
            : [];

        // Stock health
        const stockHealth = [
            { status: 'Out of Stock', count: outOfStock },
            { status: 'Low (1-5)', count: lowStock },
            { status: 'Moderate (6-20)', count: allVariants.filter(v => (v.stock || 0) > 5 && (v.stock || 0) <= 20).length },
            { status: 'Healthy (20+)', count: allVariants.filter(v => (v.stock || 0) > 20).length },
        ];

        return {
            totalActive: totalActive || 0, outOfStock, lowStock, avgSalePrice,
            topSellers, bottomSellers, categoryRevenue: [], stockHealth,
            outOfStockItems, lowStockItems
        };
    },

    // ──────────────── CUSTOMERS ────────────────
    async getCustomerAnalytics(from: Date, to: Date): Promise<CustomerAnalytics> {
        const { data: customers } = await supabase
            .from('customers')
            .select('customer_id, full_name, mobile_number, email, state, created_at')
            .order('created_at', { ascending: false });

        const allCustomers = customers || [];
        const now = new Date();
        const newThisMonth = allCustomers.filter(c => {
            const d = new Date(c.created_at);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).length;

        // Orders per customer
        const fromStr = toDateStr(from);
        const toStr = toDateStr(to);

        const { data: orders } = await supabase
            .from('orders')
            .select('customer_id, total_amount, source')
            .gte('created_at', `${fromStr}T00:00:00`)
            .lte('created_at', `${toStr}T23:59:59`)
            .neq('order_status', 'Cancelled');

        const custMap = new Map<string, { orderCount: number; totalSpend: number; source: string }>();
        (orders || []).forEach(o => {
            if (!custMap.has(o.customer_id)) custMap.set(o.customer_id, { orderCount: 0, totalSpend: 0, source: o.source });
            const entry = custMap.get(o.customer_id)!;
            entry.orderCount += 1;
            entry.totalSpend += o.total_amount || 0;
        });

        const repeatCustomers = Array.from(custMap.values()).filter(c => c.orderCount > 1).length;
        const totalWithOrders = custMap.size;
        const repeatRate = totalWithOrders > 0 ? (repeatCustomers / totalWithOrders) * 100 : 0;
        const avgLifetimeValue = totalWithOrders > 0
            ? Array.from(custMap.values()).reduce((s, c) => s + c.totalSpend, 0) / totalWithOrders
            : 0;

        // Top by orders & spend
        const customerLookup = new Map(allCustomers.map(c => [c.customer_id, c]));
        const ranked = Array.from(custMap.entries()).map(([id, v]) => {
            const c = customerLookup.get(id);
            return { name: c?.full_name || 'Unknown', mobile: c?.mobile_number || '', ...v };
        });
        const topByOrders = [...ranked].sort((a, b) => b.orderCount - a.orderCount).slice(0, 10);
        const topBySpend = [...ranked].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10);

        // By state
        const stateMap = new Map<string, number>();
        allCustomers.forEach(c => {
            const s = c.state || 'Unknown';
            stateMap.set(s, (stateMap.get(s) || 0) + 1);
        });
        const byState = Array.from(stateMap.entries())
            .map(([state, count]) => ({ state, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 15);

        // New over time (last 30 days)
        const newOverTime: { date: string; count: number }[] = [];
        const dayMap = new Map<string, number>();
        allCustomers.forEach(c => {
            const d = c.created_at?.split('T')[0] || '';
            if (d >= fromStr && d <= toStr) {
                dayMap.set(d, (dayMap.get(d) || 0) + 1);
            }
        });
        Array.from(dayMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([date, count]) => newOverTime.push({ date, count }));

        // Source breakdown
        const srcMap = new Map<string, number>();
        (orders || []).forEach(o => {
            const s = o.source || 'Unknown';
            srcMap.set(s, (srcMap.get(s) || 0) + 1);
        });
        const sourceBreakdown = Array.from(srcMap.entries()).map(([source, count]) => ({ source, count }));

        return {
            totalCustomers: allCustomers.length, newThisMonth, repeatRate,
            avgLifetimeValue, topByOrders, topBySpend, byState, newOverTime, sourceBreakdown
        };
    },

    // ──────────────── SHIPPING ────────────────
    async getShippingAnalytics(from: Date, to: Date): Promise<ShippingAnalytics> {
        const fromStr = toDateStr(from);
        const toStr = toDateStr(to);

        const { data: shipments } = await supabase
            .from('shipment_tracking')
            .select('shipment_id, order_id, shipping_status, shipping_provider, created_at, orders!inner(shipping_state)')
            .gte('created_at', `${fromStr}T00:00:00`)
            .lte('created_at', `${toStr}T23:59:59`);

        const rows = shipments || [];
        const totalShipments = rows.length;

        const statusMap = new Map<string, number>();
        rows.forEach(s => {
            const st = s.shipping_status || 'Unknown';
            statusMap.set(st, (statusMap.get(st) || 0) + 1);
        });
        const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

        const deliveredCount = statusMap.get('Delivered') || statusMap.get('delivered') || 0;
        const deliveredPct = totalShipments > 0 ? (deliveredCount / totalShipments) * 100 : 0;
        const inTransitCount = statusMap.get('In Transit') || statusMap.get('in_transit') || statusMap.get('In-Transit') || 0;
        const rtoCount = statusMap.get('RTO') || statusMap.get('rto') || 0;

        // By state
        const stateMap = new Map<string, number>();
        rows.forEach((s: any) => {
            const st = s.orders?.shipping_state || 'Unknown';
            stateMap.set(st, (stateMap.get(st) || 0) + 1);
        });
        const byState = Array.from(stateMap.entries())
            .map(([state, count]) => ({ state, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Over time
        const dayMap = new Map<string, number>();
        rows.forEach(s => {
            const d = s.created_at?.split('T')[0] || '';
            dayMap.set(d, (dayMap.get(d) || 0) + 1);
        });
        const overTime = Array.from(dayMap.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { totalShipments, deliveredCount, deliveredPct, inTransitCount, rtoCount, statusBreakdown, byState, overTime };
    },

    // ──────────────── PROCUREMENT ────────────────
    async getProcurementAnalytics(_from: Date, _to: Date): Promise<ProcurementAnalytics> {
        const { data: purchases } = await supabase
            .from('purchase')
            .select('purchase_id, invoice_no, invoice_date, amount, vendor_id, vendor:vendor_id(name)')
            .order('invoice_date', { ascending: false });

        const rows = (purchases || []) as any[];
        const totalSpend = rows.reduce((s, p) => s + (p.amount || 0), 0);
        const paidRows = rows.filter(p => p.payment_status === 'Paid');
        const paidAmount = paidRows.reduce((s, p) => s + (p.amount || 0), 0);
        const outstandingAmount = totalSpend - paidAmount;
        const activeVendors = new Set(rows.map(p => p.vendor_id)).size;

        // Vendor spend
        const vendMap = new Map<string, { amount: number; count: number }>();
        rows.forEach(p => {
            const v = p.vendor?.name || 'Unknown';
            if (!vendMap.has(v)) vendMap.set(v, { amount: 0, count: 0 });
            const entry = vendMap.get(v)!;
            entry.amount += p.amount || 0;
            entry.count += 1;
        });
        const vendorSpend = Array.from(vendMap.entries())
            .map(([vendor, v]) => ({ vendor, ...v }))
            .sort((a, b) => b.amount - a.amount);

        // Payment status
        const paid = { status: 'Paid', count: paidRows.length, amount: paidAmount };
        const pending = { status: 'Pending', count: rows.length - paidRows.length, amount: outstandingAmount };
        const paymentStatus = [paid, pending];

        // Over time (monthly)
        const monthMap = new Map<string, number>();
        rows.forEach(p => {
            const d = p.invoice_date?.substring(0, 7) || 'Unknown';
            monthMap.set(d, (monthMap.get(d) || 0) + (p.amount || 0));
        });
        const overTime = Array.from(monthMap.entries())
            .map(([month, amount]) => ({ month, amount }))
            .sort((a, b) => a.month.localeCompare(b.month));

        // Outstanding list
        const outstandingList = rows
            .filter(p => p.payment_status !== 'Paid')
            .map(p => ({
                vendor: p.vendor?.name || 'Unknown',
                invoiceNo: p.invoice_no || '',
                amount: p.amount || 0,
                date: p.invoice_date || '',
            }));

        return { totalSpend, paidAmount, outstandingAmount, activeVendors, vendorSpend, paymentStatus, overTime, outstandingList };
    },

    // ──────────────── RETURNS ────────────────
    async getReturnsAnalytics(from: Date, to: Date): Promise<ReturnsAnalytics> {
        const { data: returns } = await supabase
            .from('returns')
            .select('return_id, order_id, return_date, status, reason, refund_amount')
            .order('return_date', { ascending: false });

        const { count: totalOrders } = await supabase
            .from('orders')
            .select('order_id', { count: 'exact', head: true });

        const rows = returns || [];
        const totalReturns = rows.length;
        const returnRate = (totalOrders || 0) > 0 ? (totalReturns / (totalOrders || 1)) * 100 : 0;
        const totalRefundAmount = rows.reduce((s, r) => s + (r.refund_amount || 0), 0);
        const avgRefund = totalReturns > 0 ? totalRefundAmount / totalReturns : 0;
        const pendingReturns = rows.filter(r => ['Requested', 'Inspecting', 'Received'].includes(r.status)).length;

        // Status breakdown
        const statusMap = new Map<string, number>();
        rows.forEach(r => {
            statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
        });
        const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

        // Top reasons
        const reasonMap = new Map<string, number>();
        rows.forEach(r => {
            const reason = r.reason || 'Not specified';
            reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
        });
        const topReasons = Array.from(reasonMap.entries())
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Over time
        const fromStr = toDateStr(from);
        const toStr = toDateStr(to);
        const weekMap = new Map<string, { count: number; refundAmount: number }>();
        rows.forEach(r => {
            const d = r.return_date?.split('T')[0] || '';
            if (d >= fromStr && d <= toStr) {
                if (!weekMap.has(d)) weekMap.set(d, { count: 0, refundAmount: 0 });
                const entry = weekMap.get(d)!;
                entry.count += 1;
                entry.refundAmount += r.refund_amount || 0;
            }
        });
        const overTime = Array.from(weekMap.entries())
            .map(([date, v]) => ({ date, ...v }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return { totalReturns, returnRate, totalRefundAmount, avgRefund, pendingReturns, statusBreakdown, topReasons, overTime };
    },
};
