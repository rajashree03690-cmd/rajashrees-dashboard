'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { vendorsApiService } from '@/modules/vendors/services/vendors-api.service';
import type { Vendor } from '@/types/vendors';

interface AddVendorDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialVendor?: Vendor;
    vendors?: Vendor[];
}

export function AddVendorDialog({ open, onOpenChange, onSuccess, initialVendor, vendors = [] }: AddVendorDialogProps) {
    const [name, setName] = useState(initialVendor?.name || '');
    const [address, setAddress] = useState(initialVendor?.address || '');
    const [contactNumber, setContactNumber] = useState(initialVendor?.contact_number || '');
    const [gst, setGst] = useState(initialVendor?.gst || '');
    const [email, setEmail] = useState(initialVendor?.email || '');
    const [contactPerson, setContactPerson] = useState(initialVendor?.contact_person || '');
    const [paymentTerms, setPaymentTerms] = useState(initialVendor?.payment_terms || '');
    const [bankAccount, setBankAccount] = useState(initialVendor?.bank_account || '');
    const [ifsc, setIfsc] = useState(initialVendor?.ifsc || '');
    const [panNumber, setPanNumber] = useState(initialVendor?.pan_number || '');
    const [notes, setNotes] = useState(initialVendor?.notes || '');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial load/edit side-effects, field validation states
    const [nameError, setNameError] = useState('');
    const [contactError, setContactError] = useState('');
    const [gstError, setGstError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [panError, setPanError] = useState('');
    const [ifscError, setIfscError] = useState('');

    const isEditMode = !!initialVendor;

    // Validators
    const validateName = (val: string) => {
        if (!val.trim()) { setNameError('Name is required'); return false; }
        const isDuplicate = vendors.some(v => v.name.toLowerCase() === val.trim().toLowerCase() && v.vendor_id !== initialVendor?.vendor_id);
        if (isDuplicate) { setNameError(`Vendor "${val.trim()}" already exists`); return false; }
        setNameError(''); return true;
    };
    const validateContact = (val: string) => {
        if (!val.trim()) { setContactError('Contact number is required'); return false; }
        if (!/^[6-9]\d{9}$/.test(val)) { setContactError('Invalid Indian phone number'); return false; }
        setContactError(''); return true;
    };
    const validateGst = (val: string) => {
        if (val && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val.toUpperCase())) {
            setGstError('Invalid GST Number format'); return false;
        }
        setGstError(''); return true;
    };
    const validateEmail = (val: string) => {
        if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setEmailError('Invalid email format'); return false; }
        setEmailError(''); return true;
    };
    const validatePan = (val: string) => {
        if (val && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val.toUpperCase())) { setPanError('Invalid PAN Number format'); return false; }
        setPanError(''); return true;
    };
    const validateIfsc = (val: string) => {
        if (val && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(val.toUpperCase())) { setIfscError('Invalid IFSC format (e.g. SBIN0001234)'); return false; }
        setIfscError(''); return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const isNameValid = validateName(name);
        const isContactValid = validateContact(contactNumber);
        const isGstValid = validateGst(gst);
        const isEmailValid = validateEmail(email);
        const isPanValid = validatePan(panNumber);
        const isIfscValid = validateIfsc(ifsc);

        if (!name.trim() || !address.trim() || !contactNumber.trim()) {
            setError('Please fill all required fields (Name, Address, Contact Number)');
            return;
        }

        if (!isNameValid || !isContactValid || !isGstValid || !isEmailValid || !isPanValid || !isIfscValid) {
            setError('Please fix the validation errors before submitting');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const vendorData: Vendor = {
                name,
                address,
                contact_number: contactNumber,
                gst,
                email: email || undefined,
                contact_person: contactPerson || undefined,
                payment_terms: paymentTerms || undefined,
                bank_account: bankAccount || undefined,
                ifsc: ifsc || undefined,
                pan_number: panNumber || undefined,
                notes: notes || undefined,
                is_Active: true,
            };

            const result = isEditMode
                ? await vendorsApiService.updateVendor(initialVendor.vendor_id!, vendorData)
                : await vendorsApiService.addVendor(vendorData);

            if (result.success) {
                onSuccess();
                onOpenChange(false);
                resetForm();
            } else {
                setError(result.error || 'Failed to save vendor');
            }
        } catch (err) {
            setError('An error occurred while saving vendor');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setAddress('');
        setContactNumber('');
        setGst('');
        setEmail('');
        setContactPerson('');
        setPaymentTerms('');
        setBankAccount('');
        setIfsc('');
        setPanNumber('');
        setNotes('');
        setError(null);
        setNameError('');
        setContactError('');
        setGstError('');
        setEmailError('');
        setPanError('');
        setIfscError('');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                            {error}
                        </div>
                    )}

                    {/* Mandatory Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <Label htmlFor="name">Vendor Name *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => { setName(e.target.value); if (nameError) validateName(e.target.value); }}
                                onBlur={(e) => validateName(e.target.value)}
                                required
                                placeholder="ABC Suppliers"
                                className={nameError ? 'border-red-500' : ''}
                            />
                            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
                        </div>

                        <div className="col-span-2">
                            <Label htmlFor="address">Address *</Label>
                            <Textarea
                                id="address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                required
                                placeholder="Street, City, State, PIN"
                                rows={2}
                            />
                        </div>

                        <div>
                            <Label htmlFor="contact">Contact Number *</Label>
                            <Input
                                id="contact"
                                type="tel"
                                value={contactNumber}
                                onChange={(e) => { setContactNumber(e.target.value); if (contactError) validateContact(e.target.value); }}
                                onBlur={(e) => validateContact(e.target.value)}
                                required
                                placeholder="9876543210"
                                maxLength={10}
                                className={contactError ? 'border-red-500' : ''}
                            />
                            {contactError && <p className="text-xs text-red-600 mt-1">{contactError}</p>}
                        </div>

                        <div>
                            <Label htmlFor="gst">GST Number</Label>
                            <Input
                                id="gst"
                                value={gst}
                                onChange={(e) => { setGst(e.target.value.toUpperCase()); if (gstError) validateGst(e.target.value); }}
                                onBlur={(e) => validateGst(e.target.value)}
                                placeholder="22AAAAA0000A1Z5"
                                className={gstError ? 'border-red-500' : ''}
                            />
                            {gstError && <p className="text-xs text-red-600 mt-1">{gstError}</p>}
                        </div>
                    </div>

                    {/* Optional Fields */}
                    <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold mb-3">Additional Information (Optional)</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => { setEmail(e.target.value); if (emailError) validateEmail(e.target.value); }}
                                    onBlur={(e) => validateEmail(e.target.value)}
                                    placeholder="vendor@example.com"
                                    className={emailError ? 'border-red-500' : ''}
                                />
                                {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
                            </div>

                            <div>
                                <Label htmlFor="contact-person">Contact Person</Label>
                                <Input
                                    id="contact-person"
                                    value={contactPerson}
                                    onChange={(e) => setContactPerson(e.target.value)}
                                    placeholder="John Doe"
                                />
                            </div>

                            <div>
                                <Label htmlFor="payment-terms">Payment Terms</Label>
                                <Input
                                    id="payment-terms"
                                    value={paymentTerms}
                                    onChange={(e) => setPaymentTerms(e.target.value)}
                                    placeholder="Net 30 days"
                                />
                            </div>

                            <div>
                                <Label htmlFor="bank-account">Bank Account</Label>
                                <Input
                                    id="bank-account"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                    placeholder="1234567890"
                                />
                            </div>

                            <div>
                                <Label htmlFor="ifsc">IFSC Code</Label>
                                <Input
                                    id="ifsc"
                                    value={ifsc}
                                    onChange={(e) => { setIfsc(e.target.value.toUpperCase()); if (ifscError) validateIfsc(e.target.value); }}
                                    onBlur={(e) => validateIfsc(e.target.value)}
                                    placeholder="SBIN0001234"
                                    className={ifscError ? 'border-red-500' : ''}
                                />
                                {ifscError && <p className="text-xs text-red-600 mt-1">{ifscError}</p>}
                            </div>

                            <div>
                                <Label htmlFor="pan">PAN Number</Label>
                                <Input
                                    id="pan"
                                    value={panNumber}
                                    onChange={(e) => { setPanNumber(e.target.value.toUpperCase()); if (panError) validatePan(e.target.value); }}
                                    onBlur={(e) => validatePan(e.target.value)}
                                    placeholder="AAAAA1234A"
                                    className={panError ? 'border-red-500' : ''}
                                />
                                {panError && <p className="text-xs text-red-600 mt-1">{panError}</p>}
                            </div>

                            <div className="col-span-2">
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Additional notes..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                            {loading ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
