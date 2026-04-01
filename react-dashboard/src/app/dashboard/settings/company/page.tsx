/**
 * Company Settings Page
 * Legal details, GST, invoice configuration
 */

'use client';

import { useState, useEffect } from 'react';
import { useCompanySettings, useUpdateCompanySettings } from '@/modules/settings/hooks/use-settings';
import { usePermission } from '@/hooks/use-permission';
import { Save } from 'lucide-react';

export default function CompanyPage() {
    const { data: settings, isLoading } = useCompanySettings();
    const updateSettings = useUpdateCompanySettings();
    const { hasPermission: canEdit } = usePermission('settings.company.edit');

    const [formData, setFormData] = useState({
        legal_name: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        gst_number: '',
        pan_number: '',
        invoice_prefix: 'INV',
        invoice_terms: '',
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                legal_name: settings.legal_name || '',
                address: settings.address || '',
                city: settings.city || '',
                state: settings.state || '',
                pincode: settings.pincode || '',
                country: settings.country,
                gst_number: settings.gst_number || '',
                pan_number: settings.pan_number || '',
                invoice_prefix: settings.invoice_prefix,
                invoice_terms: settings.invoice_terms || '',
            });
        }
    }, [settings]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateSettings.mutateAsync(formData);
    };

    if (isLoading) {
        return <div className="p-6 animate-pulse">Loading...</div>;
    }

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Company Settings</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Manage your company's legal details and invoice configuration
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
                {/* Legal Details */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Legal Information</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Legal Name
                        </label>
                        <input
                            type="text"
                            value={formData.legal_name}
                            onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                            disabled={!canEdit}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Address
                        </label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            disabled={!canEdit}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                City
                            </label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                disabled={!canEdit}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                State
                            </label>
                            <input
                                type="text"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                disabled={!canEdit}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Pincode
                            </label>
                            <input
                                type="text"
                                value={formData.pincode}
                                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                                disabled={!canEdit}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Country
                            </label>
                            <input
                                type="text"
                                value={formData.country}
                                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                disabled={!canEdit}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>
                    </div>
                </div>

                {/* Tax Details */}
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium text-gray-900">Tax Information</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                GST Number
                            </label>
                            <input
                                type="text"
                                value={formData.gst_number}
                                onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                                disabled={!canEdit}
                                placeholder="22AAAAA0000A1Z5"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                PAN Number
                            </label>
                            <input
                                type="text"
                                value={formData.pan_number}
                                onChange={(e) => setFormData({ ...formData, pan_number: e.target.value })}
                                disabled={!canEdit}
                                placeholder="AAAAA0000A"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>
                    </div>
                </div>

                {/* Invoice Configuration */}
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium text-gray-900">Invoice Configuration</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Invoice Prefix
                        </label>
                        <input
                            type="text"
                            value={formData.invoice_prefix}
                            onChange={(e) => setFormData({ ...formData, invoice_prefix: e.target.value })}
                            disabled={!canEdit}
                            placeholder="INV"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Invoices will be numbered as: {formData.invoice_prefix}-0001, {formData.invoice_prefix}-0002, etc.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Invoice Terms & Conditions
                        </label>
                        <textarea
                            value={formData.invoice_terms}
                            onChange={(e) => setFormData({ ...formData, invoice_terms: e.target.value })}
                            disabled={!canEdit}
                            rows={4}
                            placeholder="Payment due within 30 days..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                    </div>
                </div>

                {canEdit && (
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={updateSettings.isPending}
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
