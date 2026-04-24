/**
 * General Settings Page
 * App name, logo, timezone, currency, and Maintenance Mode toggle
 */

'use client';

import { useState, useEffect } from 'react';
import { useAppSettings, useUpdateAppSettings } from '@/modules/settings/hooks/use-settings';
import { usePermission } from '@/hooks/use-permission';
import { useIsAdmin } from '@/hooks/useUser';
import { Save, AlertTriangle, Construction } from 'lucide-react';

const TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
];

const CURRENCIES = [
    { value: 'INR', label: '₹ INR - Indian Rupee' },
    { value: 'USD', label: '$ USD - US Dollar' },
    { value: 'EUR', label: '€ EUR - Euro' },
    { value: 'GBP', label: '£ GBP - British Pound' },
    { value: 'AED', label: 'د.إ AED - UAE Dirham' },
];

export default function GeneralPage() {
    const { data: settings, isLoading } = useAppSettings();
    const updateSettings = useUpdateAppSettings();
    const { hasPermission } = usePermission('settings.general.edit');
    const { isAdmin } = useIsAdmin();
    const canEdit = hasPermission || isAdmin;

    const [formData, setFormData] = useState({
        app_name: '',
        logo_url: '',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
    });

    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [maintenanceSaving, setMaintenanceSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            setFormData({
                app_name: settings.app_name,
                logo_url: settings.logo_url || '',
                timezone: settings.timezone,
                currency: settings.currency,
            });
            setMaintenanceMode(settings.maintenance_mode ?? false);
            setMaintenanceMessage(settings.maintenance_message ?? '');
        }
    }, [settings]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await updateSettings.mutateAsync(formData);
    };

    const handleMaintenanceToggle = async () => {
        if (!canEdit) return;
        const newValue = !maintenanceMode;

        // Confirm before enabling
        if (newValue) {
            const confirmed = window.confirm(
                '⚠️ This will immediately show a maintenance page to ALL customers on the storefront.\n\n' +
                'Payments and webhooks will continue to process normally.\n\n' +
                'Are you sure you want to enable maintenance mode?'
            );
            if (!confirmed) return;
        }

        setMaintenanceSaving(true);
        try {
            await updateSettings.mutateAsync({
                ...formData,
                maintenance_mode: newValue,
                maintenance_message: maintenanceMessage || null,
            } as any);
            setMaintenanceMode(newValue);
        } catch (err) {
            console.error('Failed to toggle maintenance mode:', err);
            alert('Failed to update maintenance mode. Please try again.');
        } finally {
            setMaintenanceSaving(false);
        }
    };

    const handleMaintenanceMessageSave = async () => {
        if (!canEdit) return;
        setMaintenanceSaving(true);
        try {
            await updateSettings.mutateAsync({
                ...formData,
                maintenance_mode: maintenanceMode,
                maintenance_message: maintenanceMessage || null,
            } as any);
        } catch (err) {
            console.error('Failed to save maintenance message:', err);
        } finally {
            setMaintenanceSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-6 animate-pulse">Loading...</div>;
    }

    return (
        <div className="p-6">
            {/* Maintenance Mode Banner (visible when active) */}
            {maintenanceMode && (
                <div className="mb-6 bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800">Maintenance Mode is ACTIVE</p>
                        <p className="text-sm text-amber-700 mt-1">
                            The storefront is currently showing a maintenance page to all customers.
                            Payments and webhooks continue to work normally.
                        </p>
                    </div>
                </div>
            )}

            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">General Settings</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Configure your application name, logo, timezone, and currency
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Application Name
                    </label>
                    <input
                        type="text"
                        value={formData.app_name}
                        onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo URL
                    </label>
                    <input
                        type="url"
                        value={formData.logo_url}
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        disabled={!canEdit}
                        placeholder="https://example.com/logo.png"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Timezone
                    </label>
                    <select
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                    >
                        {TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                                {tz.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Currency
                    </label>
                    <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                    >
                        {CURRENCIES.map((currency) => (
                            <option key={currency.value} value={currency.value}>
                                {currency.label}
                            </option>
                        ))}
                    </select>
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

            {/* ─── Maintenance Mode Section ─── */}
            <div className="mt-10 pt-8 border-t border-gray-200 max-w-2xl">
                <div className="flex items-center gap-3 mb-4">
                    <Construction className="w-5 h-5 text-gray-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Maintenance Mode</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                    When enabled, the storefront will show a maintenance page to all customers.
                    API routes, payment webhooks, and the admin dashboard are <strong>never</strong> affected.
                </p>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-5">
                    {/* Toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-800">
                                Storefront Status
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {maintenanceMode
                                    ? '🔴 Maintenance page is visible to customers'
                                    : '🟢 Storefront is live and operational'
                                }
                            </p>
                        </div>
                        <button
                            onClick={handleMaintenanceToggle}
                            disabled={!canEdit || maintenanceSaving}
                            className={`
                                relative inline-flex h-7 w-12 items-center rounded-full transition-colors
                                focus:outline-none focus:ring-2 focus:ring-offset-2
                                disabled:opacity-50 disabled:cursor-not-allowed
                                ${maintenanceMode
                                    ? 'bg-amber-500 focus:ring-amber-500'
                                    : 'bg-gray-300 focus:ring-gray-400'
                                }
                            `}
                        >
                            <span
                                className={`
                                    inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform
                                    ${maintenanceMode ? 'translate-x-6' : 'translate-x-1'}
                                `}
                            />
                        </button>
                    </div>

                    {/* Custom Message */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Custom Maintenance Message (optional)
                        </label>
                        <textarea
                            value={maintenanceMessage}
                            onChange={(e) => setMaintenanceMessage(e.target.value)}
                            disabled={!canEdit}
                            placeholder="e.g., We'll be back by 3:00 PM IST. Thank you for your patience!"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 text-sm"
                        />
                        {canEdit && maintenanceMode && (
                            <button
                                type="button"
                                onClick={handleMaintenanceMessageSave}
                                disabled={maintenanceSaving}
                                className="mt-2 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 disabled:opacity-50"
                            >
                                {maintenanceSaving ? 'Saving...' : 'Update Message'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
