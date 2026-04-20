'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Search, RefreshCw, Send, Package, CheckCircle2, FileText,
    Download, ChevronLeft, ChevronRight, Calendar, Printer, X,
    ArrowDownToLine, Building, Phone, MapPin, Plus, Trash2
} from 'lucide-react';
import { ordersService } from '@/modules/orders/services/orders.service';
import { shipmentsApiService } from '@/modules/shipments/services/shipments-api.service';
import { delhiveryService } from '@/modules/delhivery/services/delhivery.service';
import { CreateShipmentDialog } from '@/modules/delhivery/components/create-shipment-dialog';
import { supabase } from '@/lib/supabase';
import { PDFDocument } from 'pdf-lib';
import type { Order } from '@/types/orders';
import type { Shipment } from '@/types/shipments';


interface Vendor {
    vendor_id: number;
    name: string;
    address: string;
    contact_number: string;
    contact_person?: string;
    email?: string;
}

interface Purchase {
    purchase_id: number;
    invoice_no: string;
    invoice_date: string;
    amount: number;
    vendor_id: number;
    created_at: string;
}

interface InboundPickup {
    pickup_id: string;
    vendor_id: number;
    vendor_name: string;
    vendor_address: string;
    vendor_contact: string;
    vendor_pincode: string;
    vendor_city: string;
    vendor_state: string;
    purchase_id?: number;
    invoice_no?: string;
    pickup_date: string;
    expected_items: string;
    weight_grams: number;
    quantity: number;
    waybill?: string;
    status: 'scheduled' | 'pickup_requested' | 'picked_up' | 'in_transit' | 'received' | 'cancelled';
    notes?: string;
    created_at: string;
}

export default function DelhiveryIntegrationPage() {
    const [activeTab, setActiveTab] = useState<'pending' | 'shipments' | 'completed' | 'secondary' | 'inbound'>('pending');
    const [loading, setLoading] = useState(true);

    // Data states
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [secondaryShipments, setSecondaryShipments] = useState<Shipment[]>([]);

    // Inbound data
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [inboundPickups, setInboundPickups] = useState<InboundPickup[]>([]);
    const [showInboundForm, setShowInboundForm] = useState(false);

    // UI states
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const pageSizeOptions = [10, 25, 50, 100];

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Date filter
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Status/State filter
    const [filterStatus, setFilterStatus] = useState('all');

    // Bulk action loading
    const [bulkLoading, setBulkLoading] = useState(false);

    // Dialog state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Inbound form state
    const [inboundForm, setInboundForm] = useState({
        vendor_id: '',
        purchase_id: '',
        pickup_date: '',
        expected_items: '',
        weight_grams: '500',
        quantity: '1',
        vendor_pincode: '',
        vendor_city: '',
        vendor_state: '',
        notes: '',
    });
    const [inboundFormLoading, setInboundFormLoading] = useState(false);

    // Stats
    const stats = {
        pendingOrders: orders.length,
        delhiveryShipments: shipments.filter(s => s.shipping_status !== 'Delivered' && s.shipping_status !== 'Cancelled').length,
        completedShipments: shipments.filter(s => s.shipping_status === 'Delivered' || s.shipping_status === 'Cancelled').length,
        totalOrders: allOrders.length,
        inboundPickups: inboundPickups.length,
        secondaryProviders: secondaryShipments.length,
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const ordersRes = await ordersService.fetchOrders();
            setAllOrders(ordersRes.orders);
            const pending = ordersRes.orders.filter((o: Order) => {
                const status = o.order_status?.toLowerCase();
                const shipStatus = (o as any).shipment_status?.toLowerCase();
                const hasInvoice = !!(o as any).invoice_url;
                // Only show invoice-generated orders that haven't been shipped yet
                return hasInvoice &&
                    (status === 'processing' || status === 'confirmed' || status === 'invoiced') &&
                    (!shipStatus || shipStatus === 'yet to ship' || shipStatus === 'pending');
            });
            setOrders(pending);

            const shipmentsRes = await shipmentsApiService.fetchShipments();
            const allShipments = shipmentsRes.data || [];
            const delhiveryOnly = allShipments.filter((s: any) => s.shipping_provider === 'Delhivery');
            const nonDelhivery = allShipments.filter((s: any) => s.shipping_provider && s.shipping_provider !== 'Delhivery');

            // Enrich shipments with customer details from orders
            const enrichShipments = (list: any[]) => list.map((shipment: any) => {
                if (!shipment.customer_name || shipment.customer_name === '-') {
                    const matchingOrder = ordersRes.orders.find((o: any) => o.order_id === shipment.order_id);
                    if (matchingOrder) {
                        return {
                            ...shipment,
                            customer_name: matchingOrder.name || matchingOrder.customers?.full_name || '',
                            contact_number: matchingOrder.contact_number || matchingOrder.customers?.mobile_number || '',
                        };
                    }
                }
                return shipment;
            });
            const enrichedShipments = enrichShipments(delhiveryOnly);
            setShipments(enrichedShipments);
            setSecondaryShipments(enrichShipments(nonDelhivery));

            // Background sync: check Delhivery for delivery updates
            syncTrackingStatuses(enrichedShipments);

            const { data: vendorData } = await supabase
                .from('vendor')
                .select('vendor_id, name, address, contact_number, contact_person, email')
                .eq('is_active', true)
                .order('name');
            setVendors(vendorData || []);

            // Load recent purchases
            const { data: purchaseData } = await supabase
                .from('purchase')
                .select('purchase_id, invoice_no, invoice_date, amount, vendor_id, created_at')
                .order('created_at', { ascending: false })
                .limit(200);
            setPurchases((purchaseData || []) as Purchase[]);

            // Load inbound pickups from localStorage
            const stored = localStorage.getItem('delhivery_inbound_pickups');
            if (stored) {
                setInboundPickups(JSON.parse(stored));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    // ─── Sync Tracking Statuses from Delhivery ────────────────
    const syncTrackingStatuses = async (activeShipments: Shipment[]) => {
        const toSync = activeShipments.filter(
            s => s.tracking_number && s.shipping_status !== 'Delivered' && s.shipping_status !== 'Cancelled'
        );
        if (toSync.length === 0) return;

        console.log(`🔄 Syncing tracking for ${toSync.length} active shipments...`);
        let updatedCount = 0;

        for (const shipment of toSync) {
            try {
                const res = await delhiveryService.trackShipment(shipment.tracking_number);
                if (!res.success || !res.trackingData) continue;

                const shipmentData = res.trackingData?.ShipmentData?.[0]?.Shipment;
                if (!shipmentData) continue;

                const delhiveryStatus = shipmentData?.Status?.Status || '';
                let newStatus = '';

                // Map Delhivery statuses to our statuses
                if (delhiveryStatus === 'Delivered') {
                    newStatus = 'Delivered';
                } else if (delhiveryStatus === 'Returned' || delhiveryStatus === 'RTO') {
                    newStatus = 'Returned';
                } else if (delhiveryStatus === 'Out For Delivery' || delhiveryStatus === 'Out for Delivery') {
                    newStatus = 'Out for Delivery';
                } else if (delhiveryStatus === 'In Transit' || delhiveryStatus === 'Dispatched') {
                    newStatus = 'In Transit';
                } else if (delhiveryStatus === 'Manifested' || delhiveryStatus === 'Pending') {
                    newStatus = 'Shipped';
                }

                // Only update if status actually changed
                if (newStatus && newStatus !== shipment.shipping_status) {
                    // Update shipment_tracking table
                    await supabase
                        .from('shipment_tracking')
                        .update({
                            shipping_status: newStatus,
                            ...(newStatus === 'Delivered' ? { delivered_date: new Date().toISOString() } : {})
                        })
                        .eq('tracking_number', shipment.tracking_number);

                    // Update orders table when delivered
                    if (newStatus === 'Delivered' && shipment.order_id) {
                        await ordersService.updateOrderStatus(shipment.order_id, 'Delivered');
                        console.log(`✅ Order ${shipment.order_id} marked as Delivered`);
                    }

                    updatedCount++;
                    console.log(`📦 ${shipment.tracking_number}: ${shipment.shipping_status} → ${newStatus}`);
                }
            } catch (err) {
                console.error(`Failed to sync ${shipment.tracking_number}:`, err);
            }
        }

        if (updatedCount > 0) {
            console.log(`✅ Synced ${updatedCount} shipment(s). Reloading data...`);
            // Reload to reflect changes
            await loadData();
        }
    };

    useEffect(() => {
        loadData().then(() => {
            // After initial load, sync tracking statuses in background
        });
    }, []);

    const saveInboundPickups = (pickups: InboundPickup[]) => {
        setInboundPickups(pickups);
        localStorage.setItem('delhivery_inbound_pickups', JSON.stringify(pickups));
    };

    // ─── Filtered Data ────────────────────────────────────────
    const filteredData = useMemo(() => {
        let data: any[] = activeTab === 'pending' ? orders :
            activeTab === 'shipments' ? shipments.filter(s => s.shipping_status !== 'Delivered' && s.shipping_status !== 'Cancelled') : 
            activeTab === 'completed' ? shipments.filter(s => s.shipping_status === 'Delivered' || s.shipping_status === 'Cancelled') : 
            activeTab === 'secondary' ? secondaryShipments :
            inboundPickups;

        if (filterStatus !== 'all') {
            data = data.filter((item: any) => {
                if (activeTab === 'pending') return (item.shipping_state || item.state || item.customers?.state) === filterStatus;
                if (activeTab === 'shipments' || activeTab === 'completed') return item.shipping_status === filterStatus;
                if (activeTab === 'secondary') return item.shipping_status === filterStatus;
                if (activeTab === 'inbound') return item.status === filterStatus;
                return true;
            });
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            data = data.filter((item: any) =>
                (item.order_id?.toLowerCase().includes(q)) ||
                (item.name?.toLowerCase().includes(q)) ||
                (item.customers?.full_name?.toLowerCase().includes(q)) ||
                (item.customer_name?.toLowerCase().includes(q)) ||
                (item.vendor_name?.toLowerCase().includes(q)) ||
                (item.contact_number?.includes(q)) ||
                (item.tracking_number?.toLowerCase().includes(q)) ||
                (item.waybill?.toLowerCase().includes(q)) ||
                (item.invoice_no?.toLowerCase().includes(q))
            );
        }

        if (dateFrom || dateTo) {
            data = data.filter((item: any) => {
                // Use the right date field per tab
                let dateStr = '';
                if (activeTab === 'pending') {
                    dateStr = item.created_at;
                } else if (activeTab === 'shipments' || activeTab === 'completed' || activeTab === 'secondary') {
                    dateStr = item.shipped_date || item.created_at;
                } else if (activeTab === 'inbound') {
                    dateStr = item.pickup_date || item.created_at;
                } else {
                    dateStr = item.created_at || item.shipped_date || item.pickup_date;
                }
                if (!dateStr) return false;
                const itemDate = new Date(dateStr);
                if (dateFrom && itemDate < new Date(dateFrom + 'T00:00:00')) return false;
                if (dateTo && itemDate > new Date(dateTo + 'T23:59:59')) return false;
                return true;
            });
        }
        return data;
    }, [activeTab, orders, shipments, secondaryShipments, inboundPickups, searchQuery, dateFrom, dateTo, filterStatus]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    const paginatedData = filteredData.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

    // ─── Selection ────────────────────────────────────────────
    const getItemId = (item: any) => item.order_id || item.shipment_id || item.pickup_id;
    const isAllPageSelected = paginatedData.length > 0 && paginatedData.every((item: any) => selectedIds.has(getItemId(item)));

    const toggleSelectAll = () => {
        const newSet = new Set(selectedIds);
        if (isAllPageSelected) {
            paginatedData.forEach((item: any) => newSet.delete(getItemId(item)));
        } else {
            paginatedData.forEach((item: any) => newSet.add(getItemId(item)));
        }
        setSelectedIds(newSet);
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        newSet.has(id) ? newSet.delete(id) : newSet.add(id);
        setSelectedIds(newSet);
    };

    const clearSelection = () => setSelectedIds(new Set());
    const getCustomerName = (item: any) => item.name || item.customers?.full_name || item.customer_name || item.contact_number || '-';

    // ─── Export CSV ───────────────────────────────────────────
    const handleExportCSV = () => {
        const dataToExport = selectedIds.size > 0
            ? filteredData.filter((item: any) => selectedIds.has(getItemId(item)))
            : filteredData;

        if (dataToExport.length === 0) { alert('No data to export.'); return; }

        let csv = '';
        if (activeTab === 'pending') {
            csv = 'Order ID,Customer,Contact,Date,Payment Method,Total Amount,Status\n';
            dataToExport.forEach((item: any) => {
                csv += `"${item.order_id}","${getCustomerName(item)}","${item.contact_number || ''}","${item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}","${item.payment_method || ''}","${item.total_amount || 0}","${item.order_status || ''}"\n`;
            });
        } else if (activeTab === 'shipments' || activeTab === 'completed') {
            csv = 'Order ID,Customer,AWB,Status,Shipped Date\\n';
            dataToExport.forEach((item: any) => {
                csv += `"${item.order_id}","${getCustomerName(item)}","${item.tracking_number || ''}","${item.shipping_status || ''}","${item.shipped_date || ''}"\\n`;
            });
        } else {
            csv = 'Pickup ID,Vendor,Contact,Invoice,Pickup Date,Waybill,Status,Items\n';
            dataToExport.forEach((item: any) => {
                csv += `"${item.pickup_id}","${item.vendor_name}","${item.vendor_contact}","${item.invoice_no || ''}","${item.pickup_date}","${item.waybill || ''}","${item.status}","${item.expected_items}"\n`;
            });
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `delhivery_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // ─── Bulk Labels ──────────────────────────────────────────
    const handleBulkLabels = async () => {
        const selected = shipments.filter(s => selectedIds.has(getItemId(s)));
        if (selected.length === 0) { alert('Select shipments to print labels.'); return; }

        setBulkLoading(true);
        try {
            const waybills = selected.map(s => s.tracking_number).filter(Boolean);
            if (waybills.length > 0) {
                 // Delhivery API supports multiple waybills separated by commas
                 const res = await delhiveryService.generateLabel(waybills.join(','));
                 
                 if (res.success && res.pdfEncodings && res.pdfEncodings.length > 0) {
                     try {
                         const mergedPdf = await PDFDocument.create();
                         
                         for (const b64 of res.pdfEncodings) {
                             // Decode base64 to Uint8Array
                             const binaryStr = atob(b64);
                             const len = binaryStr.length;
                             const bytes = new Uint8Array(len);
                             for (let i = 0; i < len; i++) {
                                 bytes[i] = binaryStr.charCodeAt(i);
                             }
                             
                             // Load PDF and copy pages
                             const pdf = await PDFDocument.load(bytes);
                             const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                             copiedPages.forEach((page) => mergedPdf.addPage(page));
                         }
                         
                         // Save and open in new tab
                         const mergedPdfBytes = await mergedPdf.save();
                         const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
                         const blobUrl = URL.createObjectURL(blob);
                         window.open(blobUrl, '_blank');
                     } catch (mergeErr: any) {
                         console.error("Error merging PDFs:", mergeErr);
                         alert("Failed to merge bulk labels. Opening individually if possible.");
                         // Fallback: Open individual links if available
                         if (res.pdfUrls && res.pdfUrls.length > 0) {
                             res.pdfUrls.forEach(url => window.open(url, '_blank'));
                         }
                     }
                 } else if (res.success && res.pdfUrl) { 
                     // Fallback to single combined URL if provided directly
                     window.open(res.pdfUrl, '_blank'); 
                 } else { 
                     alert(res.error || "Failed to generate bulk labels."); 
                 }
            }
        } catch (err: any) { 
            alert("Error: " + err.message); 
        } finally { 
            setBulkLoading(false); 
        }
    };

    // ─── Bulk Dispatch ────────────────────────────────────────
    const handleBulkDispatch = async () => {
        const selected = orders.filter(o => selectedIds.has(getItemId(o)));
        if (selected.length === 0) { alert('Select orders to dispatch.'); return; }
        if (!confirm(`Are you sure you want to dispatch ${selected.length} orders via Delhivery?`)) return;

        setBulkLoading(true);
        let successCount = 0;
        let failCount = 0;
        let failureReasons: string[] = [];

        try {
            for (const order of selected) {
                // Calculate dynamic weight from order items, fallback to 500g if none have weights
                let totalWeight = 0;
                if (order.order_items && order.order_items.length > 0) {
                    order.order_items.forEach((item: any) => {
                        const itemWeight = item.product_variants?.weight || item.weight || 0;
                        const qty = item.quantity || 1;
                        totalWeight += (itemWeight * qty);
                    });
                }
                const weightGrams = totalWeight > 0 ? totalWeight : 500;

                // Build dynamic product descriptions
                let productsDesc = 'Clothing & Accessories';
                if (order.order_items && order.order_items.length > 0) {
                    productsDesc = order.order_items.map((item: any) => {
                        const name = item.variant_name || item.product_name || item.product_variants?.variant_name || 'Item';
                        const sku = item.product_variants?.sku || item.sku || '';
                        const qty = item.quantity || 1;
                        let desc = name;
                        if (sku) desc += ` [SKU: ${sku}]`;
                        desc += ` x${qty}`;
                        return desc;
                    }).join(', ');
                }

                // IMPORTANT: Use camelCase keys to match CreateShipmentParams interface
                const shipmentData = {
                    orderId: order.order_id,
                    pickupLocation: 'Rajashree fashion',
                    customerName: getCustomerName(order),
                    customerPhone: order.contact_number || order.customers?.mobile_number || '9999999999',
                    shippingAddress: order.shipping_address || order.customers?.address || 'N/A',
                    shippingCity: order.shipping_city || order.customers?.city || 'N/A',
                    shippingState: order.shipping_state || order.customers?.state || 'N/A',
                    shippingPincode: order.shipping_pincode || order.customers?.pincode || '000000',
                    paymentMode: order.payment_method === 'COD' ? 'COD' : 'Pre-paid' as const,
                    codAmount: order.payment_method === 'COD' ? (order.total_amount || 0) : 0,
                    totalAmount: order.total_amount || 0,
                    shippingMode: 'Surface' as const,
                    quantity: order.order_items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 1,
                    weightGrams: weightGrams,
                    productsDesc: productsDesc,
                };
                
                const res = await delhiveryService.createShipment(shipmentData as any);
                if (res.success) {
                    await ordersService.updateOrderStatus(order.order_id, 'Shipped');
                    // Save tracking info using existing updateTrackingNumber method
                    if (res.waybill) {
                        await shipmentsApiService.updateTrackingNumber(order.order_id, res.waybill, 'Delhivery');
                    }
                    successCount++;
                } else {
                    console.error(`Failed to dispatch ${order.order_id}:`, res.error);
                    failCount++;
                    failureReasons.push(`• Order ${order.order_id}: ${res.error || 'Unknown error'}`);
                }
            }
            
            let resultMessage = `Bulk Dispatch Complete:\n\n✅ ${successCount} Successful\n❌ ${failCount} Failed`;
            if (failCount > 0) {
                resultMessage += `\n\nReasons for Failure:\n${failureReasons.join('\n')}`;
            }
            
            alert(resultMessage);
            clearSelection();
            await loadData();
        } catch (err: any) {
            alert("Error during bulk dispatch: " + err.message);
        } finally {
            setBulkLoading(false);
        }
    };

    // ─── Single Actions ───────────────────────────────────────
    const handleGenerateLabel = async (waybill: string) => {
        try {
            const res = await delhiveryService.generateLabel(waybill);
            if (res.success && res.pdfUrl) window.open(res.pdfUrl, '_blank');
            else alert(res.error || "Failed to generate label.");
        } catch (err: any) { alert("Error: " + err.message); }
    };

    const handleCreateClick = (order: Order) => { setSelectedOrder(order); setShowCreateDialog(true); };

    const handleTrackAWB = (waybill: string) => {
        // Direct link to Delhivery's live tracking page
        window.open(`https://www.delhivery.com/track/package/${waybill}`, '_blank');
    };

    // ─── Cancel AWB (Delhivery) ───────────────────────────────
    const handleCancelAWB = async (shipment: Shipment) => {
        if (!shipment.tracking_number || !shipment.order_id) return;
        if (!confirm(`Are you sure you want to cancel AWB ${shipment.tracking_number}?\n\nThis will cancel the Delhivery shipment and return the order to Pending.`)) return;

        try {
            // 1. Cancel on Delhivery
            const cancelRes = await delhiveryService.cancelShipment(shipment.tracking_number);
            if (!cancelRes.success) {
                alert(`⚠️ Delhivery cancel failed: ${cancelRes.error}\n\nRemoving tracking locally anyway.`);
            }

            // 2. Delete tracking record from DB
            const deleteRes = await shipmentsApiService.deleteShipmentTracking(shipment.order_id);
            if (!deleteRes.success) {
                alert(`Failed to remove tracking record: ${deleteRes.error}`);
                return;
            }

            // 3. Revert order status back to Processing
            await ordersService.updateOrderStatus(shipment.order_id, 'Processing');

            alert(`✅ AWB ${shipment.tracking_number} cancelled. Order returned to Pending.`);
            await loadData();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    // ─── Delete Secondary Shipment ────────────────────────────
    const handleDeleteSecondary = async (shipment: Shipment) => {
        if (!shipment.order_id) return;
        if (!confirm(`Delete tracking record for ${shipment.tracking_number || shipment.order_id}?\n\nOrder will return to Pending.`)) return;

        try {
            const deleteRes = await shipmentsApiService.deleteShipmentTracking(shipment.order_id);
            if (!deleteRes.success) {
                alert(`Failed: ${deleteRes.error}`);
                return;
            }
            await ordersService.updateOrderStatus(shipment.order_id, 'Processing');
            alert('✅ Tracking record deleted. Order returned to Pending.');
            await loadData();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    // ─── Update Secondary Shipment Status ─────────────────────
    const handleUpdateSecondaryStatus = async (shipment: Shipment, newStatus: string) => {
        if (!shipment.order_id) return;
        try {
            await supabase
                .from('shipment_tracking')
                .update({
                    shipping_status: newStatus,
                    ...(newStatus === 'Delivered' ? { delivered_date: new Date().toISOString() } : {})
                })
                .eq('order_id', shipment.order_id);

            if (newStatus === 'Delivered') {
                await ordersService.updateOrderStatus(shipment.order_id, 'Delivered');
            }

            alert(`✅ Status updated to ${newStatus}`);
            await loadData();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    // ─── Track Secondary Provider ─────────────────────────────
    const handleTrackSecondary = (shipment: Shipment) => {
        const provider = shipment.shipping_provider?.toLowerCase() || '';
        const awb = shipment.tracking_number || '';
        if (provider.includes('dtdc')) {
            window.open(`https://www.dtdc.in/tracking.asp?strCnno=${awb}`, '_blank');
        } else if (provider.includes('india post')) {
            window.open(`https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx`, '_blank');
        } else if (provider.includes('franch')) {
            window.open(`https://franchexpress.com/tracking?awb=${awb}`, '_blank');
        } else if (provider.includes('blue dart')) {
            window.open(`https://www.bluedart.com/tracking/${awb}`, '_blank');
        } else if (provider.includes('ecom')) {
            window.open(`https://www.ecomexpress.in/tracking/?awb_field=${awb}`, '_blank');
        } else if (shipment.tracking_url) {
            window.open(shipment.tracking_url, '_blank');
        } else {
            alert('No tracking URL available for this provider.');
        }
    };

    // ─── Inbound: Select Vendor → auto-populate address ──────
    const selectedVendor = useMemo(() =>
        vendors.find(v => v.vendor_id === Number(inboundForm.vendor_id)), [inboundForm.vendor_id, vendors]);

    const vendorPurchases = useMemo(() =>
        purchases.filter(p => p.vendor_id === Number(inboundForm.vendor_id)), [inboundForm.vendor_id, purchases]);

    const handleVendorChange = (vendorId: string) => {
        const vendor = vendors.find(v => v.vendor_id === Number(vendorId));
        // Try to extract pincode (6-digit number) and city from vendor address
        let pincode = '';
        let city = '';
        let state = '';
        if (vendor?.address) {
            const addr = vendor.address;
            // Extract 6-digit pincode
            const pincodeMatch = addr.match(/\b(\d{6})\b/);
            if (pincodeMatch) pincode = pincodeMatch[1];
            // Use the address as city if it's short (single word/city name)
            // Otherwise try to extract common patterns
            const parts = addr.split(',').map((p: string) => p.trim()).filter(Boolean);
            if (parts.length >= 3) {
                // e.g., "123 Street, City, State 600001"
                city = parts[parts.length - 2] || '';
                state = parts[parts.length - 1]?.replace(/\d{6}/, '').trim() || '';
            } else if (parts.length === 2) {
                city = parts[0];
                state = parts[1]?.replace(/\d{6}/, '').trim() || '';
            } else {
                city = addr.replace(/\d{6}/, '').trim();
            }
        }
        setInboundForm({
            ...inboundForm,
            vendor_id: vendorId,
            purchase_id: '',
            vendor_pincode: pincode,
            vendor_city: city,
            vendor_state: state,
        });
    };

    // ─── Book Inbound Pickup via Delhivery ───────────────────
    const handleBookInboundPickup = async () => {
        if (!inboundForm.vendor_id) { alert('Select a vendor.'); return; }
        if (!inboundForm.pickup_date) { alert('Select pickup date.'); return; }
        if (!inboundForm.expected_items) { alert('Describe expected items.'); return; }
        if (!inboundForm.vendor_pincode) { alert('Enter vendor pincode.'); return; }
        if (!inboundForm.vendor_city) { alert('Enter vendor city.'); return; }
        if (!inboundForm.vendor_state) { alert('Enter vendor state.'); return; }

        const vendor = vendors.find(v => v.vendor_id === Number(inboundForm.vendor_id));
        if (!vendor) { alert('Vendor not found.'); return; }

        setInboundFormLoading(true);
        try {
            // 1. Create a Delhivery shipment with vendor address as pickup
            //    The "delivery" address is your warehouse
            const res = await delhiveryService.createShipment({
                orderId: `INB-${Date.now()}`,
                pickupLocation: vendor.name, // Delhivery registered pickup name
                customerName: 'Rajashree Fashion Warehouse', // Delivery to self
                customerPhone: '9876543210', // Warehouse phone
                shippingAddress: 'Rajashree Fashion Warehouse', // Your warehouse address
                shippingCity: 'Tirupur', // Your warehouse city
                shippingState: 'Tamil Nadu',
                shippingPincode: '641601', // Your warehouse pincode
                paymentMode: 'Prepaid',
                codAmount: 0,
                totalAmount: 0,
                weightGrams: Number(inboundForm.weight_grams) || 500,
                quantity: Number(inboundForm.quantity) || 1,
                productsDesc: inboundForm.expected_items,
            });

            const selectedPurchase = purchases.find(p => p.purchase_id === Number(inboundForm.purchase_id));

            const newPickup: InboundPickup = {
                pickup_id: `INB-${Date.now()}`,
                vendor_id: vendor.vendor_id,
                vendor_name: vendor.name,
                vendor_address: vendor.address,
                vendor_contact: vendor.contact_number,
                vendor_pincode: inboundForm.vendor_pincode,
                vendor_city: inboundForm.vendor_city,
                vendor_state: inboundForm.vendor_state,
                purchase_id: selectedPurchase?.purchase_id,
                invoice_no: selectedPurchase?.invoice_no,
                pickup_date: inboundForm.pickup_date,
                expected_items: inboundForm.expected_items,
                weight_grams: Number(inboundForm.weight_grams) || 500,
                quantity: Number(inboundForm.quantity) || 1,
                waybill: res.waybill || undefined,
                status: res.success ? 'pickup_requested' : 'scheduled',
                notes: inboundForm.notes,
                created_at: new Date().toISOString(),
            };

            const updated = [...inboundPickups, newPickup];
            saveInboundPickups(updated);

            if (res.success) {
                alert(`✅ Inbound pickup booked via Delhivery!\nAWB: ${res.waybill}\nFrom: ${vendor.name}`);
            } else {
                alert(`⚠️ Pickup saved locally but Delhivery booking failed:\n${res.error}\n\nYou can retry the Delhivery booking later.`);
            }

            setInboundForm({ vendor_id: '', purchase_id: '', pickup_date: '', expected_items: '', weight_grams: '500', quantity: '1', vendor_pincode: '', vendor_city: '', vendor_state: '', notes: '' });
            setShowInboundForm(false);
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setInboundFormLoading(false);
        }
    };

    // ─── Update Inbound Status ────────────────────────────────
    const updateInboundStatus = (pickupId: string, newStatus: InboundPickup['status']) => {
        const updated = inboundPickups.map(p => p.pickup_id === pickupId ? { ...p, status: newStatus } : p);
        saveInboundPickups(updated);
    };

    const deleteInbound = (pickupId: string) => {
        if (!confirm('Delete this inbound pickup record?')) return;
        saveInboundPickups(inboundPickups.filter(p => p.pickup_id !== pickupId));
    };

    const statusColors: Record<string, string> = {
        scheduled: 'bg-yellow-100 text-yellow-700',
        pickup_requested: 'bg-blue-100 text-blue-700',
        picked_up: 'bg-indigo-100 text-indigo-700',
        in_transit: 'bg-purple-100 text-purple-700',
        received: 'bg-green-100 text-green-700',
        cancelled: 'bg-red-100 text-red-700',
    };

    const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-blue-800">Delhivery Integration</h1>
                    <p className="text-gray-600">Manage outbound shipments, inbound pickups, and print labels.</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={loadData} variant="outline">
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-orange-50 cursor-pointer hover:bg-orange-100 transition-colors" onClick={() => { setActiveTab('pending'); setCurrentPage(0); clearSelection(); }}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-orange-600 font-semibold">Pending Orders</p>
                                <p className="text-2xl font-bold text-orange-600">{stats.pendingOrders}</p>
                            </div>
                            <Package className="h-8 w-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors" onClick={() => { setActiveTab('shipments'); setCurrentPage(0); clearSelection(); }}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 font-semibold">Active Shipments</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.delhiveryShipments}</p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 cursor-pointer hover:bg-green-100 transition-colors" onClick={() => { setActiveTab('completed'); setCurrentPage(0); clearSelection(); }}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 font-semibold">Completed</p>
                                <p className="text-2xl font-bold text-green-600">{stats.completedShipments}</p>
                            </div>
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-indigo-50 cursor-pointer hover:bg-indigo-100 transition-colors" onClick={() => { setActiveTab('inbound'); setCurrentPage(0); clearSelection(); }}>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-indigo-600 font-semibold">Inbound Pickups</p>
                                <p className="text-2xl font-bold text-indigo-600">{stats.inboundPickups}</p>
                            </div>
                            <ArrowDownToLine className="h-8 w-8 text-indigo-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gray-50">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600 font-semibold">Total Orders</p>
                                <p className="text-2xl font-bold text-gray-600">{stats.totalOrders}</p>
                            </div>
                            <FileText className="h-8 w-8 text-gray-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {[
                    { key: 'pending', label: `Pending Orders (${orders.length})` },
                    { key: 'shipments', label: `Active Shipments (${stats.delhiveryShipments})` },
                    { key: 'completed', label: `Completed (${stats.completedShipments})` },
                    { key: 'secondary', label: `Secondary Providers (${stats.secondaryProviders})` },
                    { key: 'inbound', label: `Inbound Pickups (${inboundPickups.length})` },
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${activeTab === tab.key
                            ? (tab.key === 'secondary' ? 'border-teal-600 text-teal-600' : 'border-blue-600 text-blue-600')
                            : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        onClick={() => { setActiveTab(tab.key as any); setCurrentPage(0); clearSelection(); setFilterStatus('all'); }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Action Bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-sm font-medium text-blue-700">{selectedIds.size} selected</span>
                    <div className="flex gap-2 ml-auto">
                        <Button size="sm" variant="outline" onClick={handleExportCSV}>
                            <Download className="h-3 w-3 mr-1" /> Export Selected
                        </Button>
                        {activeTab === 'pending' ? (
                            <Button size="sm" onClick={handleBulkDispatch} disabled={bulkLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                                <Send className="h-3 w-3 mr-1" /> {bulkLoading ? 'Dispatching...' : 'Bulk Dispatch'}
                            </Button>
                        ) : null}
                        {activeTab === 'shipments' || activeTab === 'completed' ? (
                            <Button size="sm" variant="outline" onClick={handleBulkLabels} disabled={bulkLoading}>
                                <Printer className="h-3 w-3 mr-1" /> {bulkLoading ? 'Printing...' : 'Bulk Labels'}
                            </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={clearSelection}><X className="h-3 w-3 mr-1" /> Clear</Button>
                    </div>
                </div>
            )}

            {/* ── Inbound Pickup Booking Form ──────────────────── */}
            {activeTab === 'inbound' && showInboundForm && (
                <Card className="border-indigo-200">
                    <CardHeader>
                        <CardTitle className="text-indigo-800">Book Inbound Pickup via Delhivery</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Vendor *</label>
                                <select
                                    value={inboundForm.vendor_id}
                                    onChange={(e) => handleVendorChange(e.target.value)}
                                    className="w-full border rounded-md px-3 py-2"
                                >
                                    <option value="">-- Select Vendor --</option>
                                    {vendors.map(v => (
                                        <option key={v.vendor_id} value={v.vendor_id}>{v.name} ({v.contact_number})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Link to Purchase (Optional)</label>
                                <select
                                    value={inboundForm.purchase_id}
                                    onChange={(e) => setInboundForm({ ...inboundForm, purchase_id: e.target.value })}
                                    className="w-full border rounded-md px-3 py-2"
                                    disabled={!inboundForm.vendor_id}
                                >
                                    <option value="">-- No Purchase Link --</option>
                                    {vendorPurchases.map(p => (
                                        <option key={p.purchase_id} value={p.purchase_id}>
                                            {p.invoice_no} — ₹{p.amount} ({new Date(p.invoice_date).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {selectedVendor && (
                            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                                <h4 className="font-semibold text-indigo-800 mb-2">Vendor Pickup Address</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                    <div className="flex items-center gap-2"><Building className="h-4 w-4 text-indigo-500" /><span>{selectedVendor.name}</span></div>
                                    <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-indigo-500" /><span>{selectedVendor.contact_number}</span></div>
                                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-indigo-500" /><span>{selectedVendor.address}</span></div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Pincode *</label>
                                <Input value={inboundForm.vendor_pincode} onChange={(e) => setInboundForm({ ...inboundForm, vendor_pincode: e.target.value })} placeholder="6-digit pincode" maxLength={6} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                                <Input value={inboundForm.vendor_city} onChange={(e) => setInboundForm({ ...inboundForm, vendor_city: e.target.value })} placeholder="City" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                                <Input value={inboundForm.vendor_state} onChange={(e) => setInboundForm({ ...inboundForm, vendor_state: e.target.value })} placeholder="State" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Date *</label>
                                <input type="date" value={inboundForm.pickup_date} onChange={(e) => setInboundForm({ ...inboundForm, pickup_date: e.target.value })} className="w-full border rounded-md px-3 py-2" min={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (grams)</label>
                                <Input type="number" value={inboundForm.weight_grams} onChange={(e) => setInboundForm({ ...inboundForm, weight_grams: e.target.value })} placeholder="500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (packages)</label>
                                <Input type="number" value={inboundForm.quantity} onChange={(e) => setInboundForm({ ...inboundForm, quantity: e.target.value })} placeholder="1" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Items *</label>
                            <Input value={inboundForm.expected_items} onChange={(e) => setInboundForm({ ...inboundForm, expected_items: e.target.value })} placeholder="e.g., 50 units SKU-001, 30 units SKU-002" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                            <textarea value={inboundForm.notes} onChange={(e) => setInboundForm({ ...inboundForm, notes: e.target.value })} className="w-full border rounded-md px-3 py-2 h-16" placeholder="Special instructions..." />
                        </div>

                        <div className="flex gap-3">
                            <Button onClick={handleBookInboundPickup} disabled={inboundFormLoading} className="bg-indigo-600 hover:bg-indigo-700">
                                {inboundFormLoading ? 'Booking via Delhivery...' : '📦 Book Pickup via Delhivery'}
                            </Button>
                            <Button variant="outline" onClick={() => setShowInboundForm(false)}>Cancel</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ─── Daily Summary Bar ─────────────────────────────── */}
            {(activeTab === 'shipments' || activeTab === 'completed' || activeTab === 'secondary') && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border rounded-lg p-4 flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Pickups in View</p>
                            <p className="text-xl font-bold text-gray-900">{filteredData.length}</p>
                        </div>
                    </div>
                    <div className="bg-white border rounded-lg p-4 flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-full">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Total Shipping Cost</p>
                            <p className="text-xl font-bold text-gray-900">
                                ₹{filteredData.reduce((sum: number, item: any) => sum + (Number(item.shipping_cost) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white border rounded-lg p-4 flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-full">
                            <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-medium">Avg Cost / Shipment</p>
                            <p className="text-xl font-bold text-gray-900">
                                {(() => {
                                    const totalCost = filteredData.reduce((sum: number, item: any) => sum + (Number(item.shipping_cost) || 0), 0);
                                    const count = filteredData.filter((item: any) => Number(item.shipping_cost) > 0).length;
                                    return count > 0 ? `₹${(totalCost / count).toFixed(2)}` : '—';
                                })()}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
                    <CardTitle>
                        {activeTab === 'pending' ? 'Select Order to Dispatch' :
                            activeTab === 'shipments' ? 'Active Waybills' : 
                            activeTab === 'completed' ? 'Completed Waybills' :
                            activeTab === 'secondary' ? 'Secondary Provider Shipments' : 'Inbound Pickup Records'}
                    </CardTitle>
                    <div className="flex items-center gap-3 flex-wrap">
                        {activeTab === 'inbound' && (
                            <Button size="sm" onClick={() => setShowInboundForm(!showInboundForm)} className="bg-indigo-600 hover:bg-indigo-700">
                                <Plus className="h-3 w-3 mr-1" /> Book Pickup
                            </Button>
                        )}
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(0); }} className="border rounded px-2 py-1 text-sm" />
                            <span className="text-gray-400">→</span>
                            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(0); }} className="border rounded px-2 py-1 text-sm" />
                            {(dateFrom || dateTo) && (
                                <Button size="sm" variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); }}><X className="h-3 w-3" /></Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {activeTab === 'pending' && Array.from(new Set(orders.map(o => o.shipping_state || o.state || o.customers?.state).filter(Boolean))).length > 0 && (
                                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(0); }} className="border rounded px-2 py-1.5 text-sm bg-white text-gray-700 min-w-[120px]">
                                    <option value="all">All States</option>
                                    {Array.from(new Set(orders.map(o => o.shipping_state || o.state || o.customers?.state).filter(Boolean))).sort().map(st => (
                                        <option key={st} value={st}>{st}</option>
                                    ))}
                                </select>
                            )}
                            {activeTab === 'shipments' && (
                                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(0); }} className="border rounded px-2 py-1.5 text-sm bg-white text-gray-700 min-w-[120px]">
                                    <option value="all">All Statuses</option>
                                    {Array.from(new Set(shipments.filter(s => s.shipping_status !== 'Delivered' && s.shipping_status !== 'Cancelled').map(s => s.shipping_status).filter(Boolean))).sort().map(st => (
                                        <option key={st} value={st}>{st}</option>
                                    ))}
                                </select>
                            )}
                            {activeTab === 'completed' && (
                                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(0); }} className="border rounded px-2 py-1.5 text-sm bg-white text-gray-700 min-w-[120px]">
                                    <option value="all">All Statuses</option>
                                    {Array.from(new Set(shipments.filter(s => s.shipping_status === 'Delivered' || s.shipping_status === 'Cancelled').map(s => s.shipping_status).filter(Boolean))).sort().map(st => (
                                        <option key={st} value={st}>{st}</option>
                                    ))}
                                </select>
                            )}
                            {activeTab === 'inbound' && (
                                <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(0); }} className="border rounded px-2 py-1.5 text-sm bg-white text-gray-700 min-w-[120px]">
                                    <option value="all">All Statuses</option>
                                    {['scheduled', 'pickup_requested', 'picked_up', 'in_transit', 'received', 'cancelled'].map(st => (
                                        <option key={st} value={st}>{st.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input placeholder="Search..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }} className="pl-10" />
                        </div>
                        <Button size="sm" variant="outline" onClick={handleExportCSV}>
                            <Download className="h-3 w-3 mr-1" /> Export
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-12"><RefreshCw className="h-8 w-8 animate-spin text-blue-500" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-left border-b text-sm text-gray-600">
                                        <th className="p-3 w-10">
                                            <input type="checkbox" checked={isAllPageSelected} onChange={toggleSelectAll} className="rounded" />
                                        </th>
                                        {activeTab === 'pending' && (<>
                                            <th className="p-3">Order ID</th><th className="p-3">Customer</th><th className="p-3">Contact</th>
                                            <th className="p-3">Date</th><th className="p-3">Payment</th><th className="p-3">Total</th><th className="p-3">Invoice</th><th className="p-3">Action</th>
                                        </>)}
                                        {(activeTab === 'shipments' || activeTab === 'completed') && (<>
                                            <th className="p-3">Order ID</th><th className="p-3">Customer</th><th className="p-3">Contact</th>
                                            <th className="p-3">AWB</th><th className="p-3">Status</th><th className="p-3">Shipped</th><th className="p-3 text-right">Actions</th>
                                        </>)}
                                        {activeTab === 'secondary' && (<>
                                            <th className="p-3">Order ID</th><th className="p-3">Customer</th><th className="p-3">Contact</th>
                                            <th className="p-3">Provider</th><th className="p-3">AWB</th><th className="p-3">Status</th><th className="p-3">Shipped</th><th className="p-3 text-right">Actions</th>
                                        </>)}
                                        {activeTab === 'inbound' && (<>
                                            <th className="p-3">Pickup ID</th><th className="p-3">Vendor</th><th className="p-3">Contact</th>
                                            <th className="p-3">Invoice</th><th className="p-3">Pickup Date</th><th className="p-3">AWB</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th>
                                        </>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.length === 0 && (
                                        <tr><td colSpan={9} className="text-center p-8 text-gray-500">No data found</td></tr>
                                    )}
                                    {paginatedData.map((item: any) => {
                                        const id = getItemId(item);
                                        return (
                                            <tr key={id} className={`border-b text-sm ${selectedIds.has(id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                                <td className="p-3"><input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleSelect(id)} className="rounded" /></td>

                                                {activeTab === 'pending' && (<>
                                                    <td className="p-3 font-medium">{item.order_id}</td>
                                                    <td className="p-3">{getCustomerName(item)}</td>
                                                    <td className="p-3 text-gray-500">{item.contact_number || item.customers?.mobile_number || '-'}</td>
                                                    <td className="p-3">{item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}</td>
                                                    <td className="p-3">
                                                        {item.payment_transaction_id ? (
                                                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">Paid</span>
                                                        ) : (
                                                            <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">Pending</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 font-medium">₹{item.total_amount || 0}</td>
                                                    <td className="p-3">
                                                        {item.invoice_url ? (
                                                            <a href={item.invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                                                <FileText className="h-3 w-3" />
                                                                {item.invoice_number || 'View'}
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <Button size="sm" onClick={() => handleCreateClick(item)} className="bg-blue-600 hover:bg-blue-700">
                                                            <Send className="h-3 w-3 mr-1" /> Dispatch
                                                        </Button>
                                                    </td>
                                                </>)}

                                                {(activeTab === 'shipments' || activeTab === 'completed') && (<>
                                                    <td className="p-3 font-medium">{item.order_id}</td>
                                                    <td className="p-3">{getCustomerName(item)}</td>
                                                    <td className="p-3 text-gray-500">{item.contact_number || item.customers?.mobile_number || '-'}</td>
                                                    <td className="p-3 text-blue-600 font-medium">{item.tracking_number}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${item.shipping_status === 'Delivered' ? 'bg-green-100 text-green-700' : item.shipping_status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {item.shipping_status || 'Generated'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-gray-500">{item.shipped_date ? new Date(item.shipped_date).toLocaleDateString() : '-'}</td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <Button size="sm" variant="outline" onClick={() => handleGenerateLabel(item.tracking_number)}>
                                                                <FileText className="h-3 w-3 mr-1" /> Label
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => handleTrackAWB(item.tracking_number)}>
                                                                <Package className="h-3 w-3 mr-1" /> Track
                                                            </Button>
                                                            {item.shipping_status !== 'Delivered' && item.shipping_status !== 'Cancelled' && item.shipping_provider === 'Delhivery' && (
                                                                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleCancelAWB(item)}>
                                                                    <Trash2 className="h-3 w-3 mr-1" /> Cancel
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>)}

                                                {activeTab === 'secondary' && (<>
                                                    <td className="p-3 font-medium">{item.order_id}</td>
                                                    <td className="p-3">{getCustomerName(item)}</td>
                                                    <td className="p-3 text-gray-500">{item.contact_number || '-'}</td>
                                                    <td className="p-3">
                                                        <span className="px-2 py-1 rounded text-xs font-medium bg-teal-100 text-teal-700">
                                                            {item.shipping_provider}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-blue-600 font-medium">{item.tracking_number || '-'}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${item.shipping_status === 'Delivered' ? 'bg-green-100 text-green-700' : item.shipping_status === 'Cancelled' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>
                                                            {item.shipping_status || 'Shipped'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-gray-500">{item.shipped_date ? new Date(item.shipped_date).toLocaleDateString() : '-'}</td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex gap-1 justify-end flex-wrap">
                                                            <Button size="sm" variant="outline" onClick={() => handleTrackSecondary(item)}>
                                                                <Package className="h-3 w-3 mr-1" /> Track
                                                            </Button>
                                                            {item.shipping_status === 'Shipped' && (
                                                                <Button size="sm" variant="outline" onClick={() => handleUpdateSecondaryStatus(item, 'In Transit')}>In Transit</Button>
                                                            )}
                                                            {item.shipping_status === 'In Transit' && (
                                                                <Button size="sm" variant="outline" onClick={() => handleUpdateSecondaryStatus(item, 'Out for Delivery')}>Out for Delivery</Button>
                                                            )}
                                                            {(item.shipping_status === 'Out for Delivery' || item.shipping_status === 'In Transit') && (
                                                                <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleUpdateSecondaryStatus(item, 'Delivered')}>Delivered</Button>
                                                            )}
                                                            {item.shipping_status !== 'Delivered' && (
                                                                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDeleteSecondary(item)}>
                                                                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>)}

                                                {activeTab === 'inbound' && (<>
                                                    <td className="p-3 font-medium text-indigo-600">{item.pickup_id}</td>
                                                    <td className="p-3">{item.vendor_name}</td>
                                                    <td className="p-3 text-gray-500">{item.vendor_contact}</td>
                                                    <td className="p-3">{item.invoice_no || '-'}</td>
                                                    <td className="p-3">{new Date(item.pickup_date).toLocaleDateString()}</td>
                                                    <td className="p-3 text-blue-600 font-medium">{item.waybill || '-'}</td>
                                                    <td className="p-3">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[item.status] || 'bg-gray-100 text-gray-700'}`}>
                                                            {formatStatus(item.status)}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <div className="flex gap-1 justify-end">
                                                            {item.waybill && (
                                                                <Button size="sm" variant="outline" onClick={() => handleTrackAWB(item.waybill)}>Track</Button>
                                                            )}
                                                            {item.status === 'pickup_requested' && (
                                                                <Button size="sm" variant="outline" onClick={() => updateInboundStatus(item.pickup_id, 'in_transit')}>In Transit</Button>
                                                            )}
                                                            {item.status === 'in_transit' && (
                                                                <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateInboundStatus(item.pickup_id, 'received')}>Received</Button>
                                                            )}
                                                            {item.status === 'scheduled' && (
                                                                <Button size="sm" variant="outline" className="text-red-600" onClick={() => updateInboundStatus(item.pickup_id, 'cancelled')}>Cancel</Button>
                                                            )}
                                                            {(item.status === 'received' || item.status === 'cancelled') && (
                                                                <Button size="sm" variant="ghost" className="text-red-500" onClick={() => deleteInbound(item.pickup_id)}>Delete</Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </>)}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 border-t pt-4 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                                Showing {filteredData.length > 0 ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, filteredData.length)} of {filteredData.length}
                            </span>
                            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(0); }} className="border rounded px-2 py-1 text-sm">
                                {pageSizeOptions.map(s => <option key={s} value={s}>{s} per page</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(0)}>First</Button>
                            <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(c => c - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                            <span className="text-sm px-3 py-1 bg-gray-100 rounded">{currentPage + 1} / {totalPages}</span>
                            <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(c => c + 1)}><ChevronRight className="h-4 w-4" /></Button>
                            <Button variant="outline" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(totalPages - 1)}>Last</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <CreateShipmentDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                order={selectedOrder}
                onSuccess={() => { loadData(); }}
            />
        </div>
    );
}
