'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Truck } from 'lucide-react';
import { delhiveryService } from '@/modules/delhivery/services/delhivery.service';
import { shipmentsApiService } from '@/modules/shipments/services/shipments-api.service';
import { ordersService } from '@/modules/orders/services/orders.service';
import { SHIPPING_PROVIDERS, type ShippingProvider } from '@/types/shipments';
import type { Order } from '@/types/orders';

interface CreateShipmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    order: Order | null;
    onSuccess: () => void;
}

type PincodeStatus = 'idle' | 'checking' | 'serviceable' | 'not_serviceable' | 'error';

export function CreateShipmentDialog({ open, onOpenChange, order, onSuccess }: CreateShipmentDialogProps) {
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showFallback, setShowFallback] = useState(false);

    // Form fields
    const [weight, setWeight] = useState('500');
    const [pincode, setPincode] = useState('');
    const [phone, setPhone] = useState('');
    const [shippingMode, setShippingMode] = useState<'Surface' | 'Express'>('Surface');
    const [city, setCity] = useState('');
    const [stateName, setStateName] = useState('');
    const [address, setAddress] = useState('');
    const [shippingCost, setShippingCost] = useState('');

    // Pincode serviceability
    const [pincodeStatus, setPincodeStatus] = useState<PincodeStatus>('idle');
    const [pincodeInfo, setPincodeInfo] = useState<any>(null);

    // Fallback provider (when not serviceable)
    const [selectedProvider, setSelectedProvider] = useState('');
    const [manualTrackingNumber, setManualTrackingNumber] = useState('');
    const [trackingUrl, setTrackingUrl] = useState('');

    // Auto-detect provider from tracking number
    useEffect(() => {
        if (!manualTrackingNumber) return;
        let provider = '';
        // India Post → CxxxxxIN
        if (manualTrackingNumber.startsWith('C') && manualTrackingNumber.endsWith('IN')) {
            provider = 'India Post';
        }
        // DTDC → Starts with C + digits but NOT ending with IN
        else if (/^C\d+$/.test(manualTrackingNumber)) {
            provider = 'DTDC';
        }
        // Franch Express → numeric only + starts with 480
        else if (/^480\d+$/.test(manualTrackingNumber)) {
            provider = 'Franch Express';
        }
        if (provider) setSelectedProvider(provider);
    }, [manualTrackingNumber]);

    // Pre-fill on open
    useEffect(() => {
        if (open && order) {
            const rawAddress = order.shipping_address || '';
            setAddress(rawAddress);
            setStateName(order.shipping_state || '');

            const extractedPin = order.shipping_pincode ||
                (rawAddress.match(/\b\d{6}\b/)?.[0] ?? '');
            setPincode(extractedPin);

            const addressParts = rawAddress.split(',').map((p: string) => p.trim());
            let extractedCity = '';
            if (addressParts.length >= 3) {
                extractedCity = addressParts[addressParts.length - 2]
                    .replace(/\d{6}/, '').trim();
            } else if (addressParts.length === 2) {
                extractedCity = addressParts[0].replace(/\d{6}/, '').trim();
            }
            setCity(extractedCity);

            const phoneMatch = order.contact_number?.replace(/\D/g, '').slice(-10);
            setPhone(phoneMatch || order.contact_number || '');

            // Reset states
            setPincodeStatus('idle');
            setPincodeInfo(null);
            setSelectedProvider('');
            setManualTrackingNumber('');
            setErrorMessage('');
            setShowFallback(false);
            setShippingCost('');
        }
    }, [open, order]);

    // Auto-check pincode when it changes and is 6 digits
    const checkPincode = useCallback(async (pin: string, mode: 'Surface' | 'Express') => {
        if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
            setPincodeStatus('idle');
            setPincodeInfo(null);
            return;
        }

        setPincodeStatus('checking');
        try {
            const result = await delhiveryService.checkPincode(pin, mode);
            if (result.serviceable) {
                setPincodeStatus('serviceable');
                setPincodeInfo(result);
                // Auto-fill city/state from Delhivery if available and empty
                if (result.city && !city) setCity(result.city);
                if (result.state && !stateName) setStateName(result.state);
            } else {
                setPincodeStatus('not_serviceable');
                setPincodeInfo(result);
            }
        } catch {
            setPincodeStatus('error');
            setPincodeInfo(null);
        }
    }, [city, stateName]);

    // Debounce pincode check
    useEffect(() => {
        if (pincode.length === 6) {
            const timeout = setTimeout(() => checkPincode(pincode, shippingMode), 500);
            return () => clearTimeout(timeout);
        } else {
            setPincodeStatus('idle');
        }
    }, [pincode, shippingMode, checkPincode]);

    // Handle creating shipment via Delhivery
    const handleDelhiveryShipment = async () => {
        if (!order) return;
        setErrorMessage('');
        if (!phone || phone.length !== 10) { setErrorMessage('Phone number must be 10 digits.'); return; }
        if (!pincode || pincode.length !== 6) { setErrorMessage('Pincode must be 6 digits.'); return; }
        if (!city) { setErrorMessage('City is required.'); return; }
        if (!address) { setErrorMessage('Address is required.'); return; }
        if (!stateName) { setErrorMessage('State is required.'); return; }
        if (!weight || isNaN(Number(weight))) { setErrorMessage('Valid weight in grams is required.'); return; }

        setLoading(true);
        try {
            // Prepaid-only business — no COD
            const pMode = 'Pre-paid';

            // Build actual product description from order items
            let items: any[] = [];
            try {
                items = await ordersService.fetchOrderItems(order.order_id);
            } catch (err) {
                console.error('Failed to fetch order items:', err);
                items = order.order_items || [];
            }
            if (!items.length) {
                items = order.order_items || [];
            }
            
            const productsDesc = items.length
                ? items
                    .map((item: any) => {
                        const name = item.variant_name || item.product_name || item.product_variants?.variant_name || 'Item';
                        const sku = item.product_variants?.sku || item.sku || '';
                        const qty = item.quantity || 1;
                        let desc = name;
                        if (sku) desc += ` [SKU: ${sku}]`;
                        desc += ` x${qty}`;
                        return desc;
                    })
                    .join(', ')
                : 'Clothing & Accessories';

            const delhiveryResult = await delhiveryService.createShipment({
                orderId: order.order_id,
                pickupLocation: 'Rajashree fashion',
                customerName: order.name,
                customerPhone: phone,
                shippingAddress: address,
                shippingCity: city,
                shippingState: stateName,
                shippingPincode: pincode,
                paymentMode: pMode,
                codAmount: 0,
                totalAmount: order.total_amount,
                weightGrams: Number(weight),
                shippingMode: shippingMode,
                quantity: order.order_items?.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0) || 1,
                productsDesc
            });

            if (!delhiveryResult.success || !delhiveryResult.waybill) {
                const errMsg = delhiveryResult.error || 'Failed to generate AWB from Delhivery.';
                // Detect serviceability rejection from Delhivery create API
                const isServiceabilityError = /non.?serviceable|not.?serviceable|serviceability|not.?available/i.test(errMsg);
                if (isServiceabilityError) {
                    setErrorMessage(`Delhivery rejected this pincode: ${errMsg}. Please use a secondary provider below.`);
                    setShowFallback(true);
                    setPincodeStatus('not_serviceable');
                } else {
                    setErrorMessage(errMsg);
                }
                return;
            }

            const dbResult = await shipmentsApiService.updateTrackingNumber(
                order.order_id,
                delhiveryResult.waybill,
                'Delhivery',
                true,
                Number(shippingCost) || 0
            );

            if (!dbResult.success) {
                setErrorMessage(dbResult.error || 'AWB generated but failed to save in database.');
                return;
            }

            // Send dispatch email
            try {
                await ordersService.sendOrderNotification(
                    'order_dispatched',
                    order.order_id,
                    delhiveryResult.waybill,
                    'Delhivery'
                );
            } catch (emailErr) {
                console.error('⚠️ Email send failed (shipment still created):', emailErr);
            }

            alert(`✅ Shipment created! AWB: ${delhiveryResult.waybill}`);
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Shipment creation error:', error);
            const errMsg = error.message || 'Unknown error occurred';
            const isServiceabilityError = /non.?serviceable|not.?serviceable|serviceability|not.?available/i.test(errMsg);
            if (isServiceabilityError) {
                setErrorMessage(`Delhivery rejected this pincode: ${errMsg}. Please use a secondary provider below.`);
                setShowFallback(true);
                setPincodeStatus('not_serviceable');
            } else {
                setErrorMessage(errMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle manual booking with alternative provider
    const handleManualShipment = async () => {
        if (!order) return;
        setErrorMessage('');
        if (!selectedProvider) { setErrorMessage('Please select a shipping provider.'); return; }
        if (!manualTrackingNumber.trim()) { setErrorMessage('Please enter the tracking number.'); return; }

        setLoading(true);
        try {
            const dbResult = await shipmentsApiService.updateTrackingNumber(
                order.order_id,
                manualTrackingNumber.trim(),
                selectedProvider,
                true,
                Number(shippingCost) || 0
            );

            if (!dbResult.success) {
                setErrorMessage(dbResult.error || 'Failed to save shipment in database.');
                return;
            }

            // Send dispatch email
            try {
                await ordersService.sendOrderNotification(
                    'order_dispatched',
                    order.order_id,
                    manualTrackingNumber.trim(),
                    selectedProvider
                );
            } catch (emailErr) {
                console.error('⚠️ Email failed:', emailErr);
            }

            alert(`✅ Shipment booked via ${selectedProvider}! Tracking: ${manualTrackingNumber.trim()}`);
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error('Manual shipment error:', error);
            setErrorMessage(error.message || 'Unknown error occurred');
        } finally {
            setLoading(false);
        }
    };

    if (!order) return null;

    const isServiceable = pincodeStatus === 'serviceable';
    const isNotServiceable = pincodeStatus === 'not_serviceable' || showFallback;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle>Book Shipment — {order.order_id}</DialogTitle>
                    <DialogDescription>Configure shipment details and generate AWB via Delhivery</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4 max-h-[65vh] overflow-y-auto">
                    {/* Inline Error Banner */}
                    {errorMessage && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-red-800">Shipment Error</p>
                                <p className="text-xs text-red-700 mt-1">{errorMessage}</p>
                            </div>
                            <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-red-600">
                                <XCircle className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                    {/* Order Summary */}
                    <div className="bg-gray-50 p-3 rounded-lg text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <p><strong>Customer:</strong> {order.name}</p>
                            <p><strong>Amount:</strong> ₹{order.total_amount}</p>
                            <p><strong>Payment:</strong> {order.payment_method || 'Prepaid'}</p>
                            <p><strong>Source:</strong> {(order as any).source || '-'}</p>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="grid gap-2">
                        <Label>Delivery Address</Label>
                        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
                    </div>

                    {/* City + State */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>City</Label>
                            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="E.g. Madurai" />
                        </div>
                        <div className="grid gap-2">
                            <Label>State</Label>
                            <Input value={stateName} onChange={(e) => setStateName(e.target.value)} placeholder="E.g. Tamil Nadu" />
                        </div>
                    </div>

                    {/* Pincode + Serviceability Check */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label>Pincode (6 digits)</Label>
                            <div className="relative">
                                <Input
                                    value={pincode}
                                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength={6}
                                    className={
                                        isServiceable ? 'border-green-500 pr-8' :
                                            isNotServiceable ? 'border-red-500 pr-8' : 'pr-8'
                                    }
                                />
                                {pincodeStatus === 'checking' && (
                                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-gray-400" />
                                )}
                                {isServiceable && (
                                    <CheckCircle className="absolute right-2 top-2.5 h-4 w-4 text-green-600" />
                                )}
                                {isNotServiceable && (
                                    <XCircle className="absolute right-2 top-2.5 h-4 w-4 text-red-600" />
                                )}
                            </div>

                            {/* Serviceability Badge */}
                            {isServiceable && (
                                <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                                    <CheckCircle className="h-3 w-3" />
                                    Delhivery Serviceable
                                    {pincodeInfo?.cod && <span className="ml-1 bg-green-200 px-1 rounded">COD</span>}
                                    {pincodeInfo?.pre_paid && <span className="bg-green-200 px-1 rounded">Prepaid</span>}
                                </div>
                            )}
                            {isNotServiceable && (
                                <div className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-2 rounded flex-col items-start">
                                    <div className="flex items-center gap-1 font-semibold">
                                        <XCircle className="h-3 w-3" />
                                        Not serviceable by Delhivery
                                    </div>
                                    {pincodeInfo?.error && (
                                        <div className="text-[10px] opacity-90 mt-1 max-w-[200px] leading-tight">
                                            {pincodeInfo.error}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label>Phone (10 digits)</Label>
                            <Input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                maxLength={10}
                            />
                        </div>
                    </div>

                        <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-2">
                            <Label>Weight (grams)</Label>
                            <Input value={weight} onChange={(e: any) => setWeight(e.target.value)} type="number" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Shipping Mode</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={shippingMode}
                                onChange={(e: any) => setShippingMode(e.target.value as 'Surface' | 'Express')}
                            >
                                <option value="Surface">Surface</option>
                                <option value="Express">Express</option>
                            </select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Shipping Cost (₹)</Label>
                            <Input
                                value={shippingCost}
                                onChange={(e: any) => setShippingCost(e.target.value)}
                                type="number"
                                placeholder="e.g. 75"
                            />
                        </div>
                    </div>

                    {/* Fallback Provider Section (Only when NOT serviceable) */}
                    {isNotServiceable && (
                        <div className="border-t pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-3 bg-amber-50 p-3 rounded-lg border border-amber-200">
                                <Truck className="h-5 w-5 text-amber-600" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-800">
                                        Book via Secondary Provider
                                    </p>
                                    <p className="text-xs text-amber-600">Delhivery doesn't service this pincode. Use an alternative courier.</p>
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <div className="grid gap-2">
                                    <Label>Tracking Number *</Label>
                                    <Input
                                        value={manualTrackingNumber}
                                        onChange={(e) => setManualTrackingNumber(e.target.value)}
                                        placeholder="Scan or enter tracking / AWB number"
                                    />
                                    {manualTrackingNumber && selectedProvider && (
                                        <p className="text-xs text-green-600 flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3" /> Auto-detected: {selectedProvider}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-2">
                                    <Label>Shipping Provider *</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={selectedProvider}
                                        onChange={(e) => setSelectedProvider(e.target.value)}
                                    >
                                        <option value="">-- Select Provider --</option>
                                        {SHIPPING_PROVIDERS.filter(p => p !== 'Delhivery').map(provider => (
                                            <option key={provider} value={provider}>{provider}</option>
                                        ))}
                                        <option value="Blue Dart">Blue Dart</option>
                                        <option value="Ecom Express">Ecom Express</option>
                                        <option value="Professional Couriers">Professional Couriers</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Tracking URL (optional)</Label>
                                    <Input
                                        value={trackingUrl}
                                        onChange={(e) => setTrackingUrl(e.target.value)}
                                        placeholder="https://tracking.example.com/..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>

                    {/* Main action button changes based on serviceability */}
                    {isNotServiceable ? (
                        <Button
                            onClick={handleManualShipment}
                            disabled={loading || !selectedProvider || !manualTrackingNumber.trim()}
                            className="bg-amber-600 hover:bg-amber-700"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Book via {selectedProvider || 'Provider'}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleDelhiveryShipment}
                            disabled={loading || pincodeStatus === 'checking'}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {pincodeStatus === 'checking' ? 'Checking...' : 'Generate AWB via Delhivery'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
