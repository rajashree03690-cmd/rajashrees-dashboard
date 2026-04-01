/**
 * Appearance Settings Page
 * Theme editor with live preview
 */

'use client';

import { useState, useEffect } from 'react';
import { useThemeSettings, useUpdateThemeSettings } from '@/modules/settings/hooks/use-theme';
import { previewTheme } from '@/modules/settings/services/theme.service';
import { usePermission } from '@/hooks/use-permission';
import { Save, Undo } from 'lucide-react';

const FONT_OPTIONS = [
    { value: 'Inter', label: 'Inter' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Outfit', label: 'Outfit' },
    { value: 'Poppins', label: 'Poppins' },
];

const BORDER_RADIUS_OPTIONS = [
    { value: '0px', label: 'None' },
    { value: '4px', label: 'Small' },
    { value: '8px', label: 'Medium' },
    { value: '12px', label: 'Large' },
    { value: '16px', label: 'Extra Large' },
];

export default function AppearancePage() {
    const { data: theme, isLoading } = useThemeSettings();
    const updateTheme = useUpdateThemeSettings();
    const { hasPermission: canEdit } = usePermission('settings.appearance.edit');

    const [formData, setFormData] = useState({
        theme_mode: 'system' as 'light' | 'dark' | 'system',
        primary_color: '#7c3aed',
        secondary_color: '#a855f7',
        sidebar_bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        sidebar_text: '#ffffff',
        font_family: 'Inter',
        border_radius: '8px',
    });

    // Load theme data
    useEffect(() => {
        if (theme) {
            setFormData({
                theme_mode: theme.theme_mode,
                primary_color: theme.primary_color,
                secondary_color: theme.secondary_color,
                sidebar_bg: theme.sidebar_bg,
                sidebar_text: theme.sidebar_text,
                font_family: theme.font_family,
                border_radius: theme.border_radius,
            });
        }
    }, [theme]);

    // Live preview on change
    useEffect(() => {
        previewTheme(formData);
    }, [formData]);

    const handleSave = async () => {
        await updateTheme.mutateAsync(formData);
    };

    const handleReset = () => {
        if (theme) {
            setFormData({
                theme_mode: theme.theme_mode,
                primary_color: theme.primary_color,
                secondary_color: theme.secondary_color,
                sidebar_bg: theme.sidebar_bg,
                sidebar_text: theme.sidebar_text,
                font_family: theme.font_family,
                border_radius: theme.border_radius,
            });
        }
    };

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-64 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Appearance</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Customize the look and feel of your dashboard
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
                    >
                        <Undo className="w-4 h-4" />
                        Reset
                    </button>
                    {canEdit && (
                        <button
                            onClick={handleSave}
                            disabled={updateTheme.isPending}
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {updateTheme.isPending ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                </div>
            </div>

            {/* Theme Settings */}
            <div className="space-y-6">
                {/* Theme Mode */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Theme Mode
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                        {(['light', 'dark', 'system'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setFormData({ ...formData, theme_mode: mode })}
                                disabled={!canEdit}
                                className={`
                  px-4 py-3 text-sm font-medium border rounded-md capitalize transition
                  ${formData.theme_mode === mode
                                        ? 'bg-purple-50 border-purple-600 text-purple-700'
                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Colors */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Primary Color
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="color"
                                value={formData.primary_color}
                                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                disabled={!canEdit}
                                className="h-10 w-20 rounded border border-gray-300 cursor-pointer disabled:opacity-50"
                            />
                            <input
                                type="text"
                                value={formData.primary_color}
                                onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                disabled={!canEdit}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Secondary Color
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="color"
                                value={formData.secondary_color}
                                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                disabled={!canEdit}
                                className="h-10 w-20 rounded border border-gray-300 cursor-pointer disabled:opacity-50"
                            />
                            <input
                                type="text"
                                value={formData.secondary_color}
                                onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                disabled={!canEdit}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar Colors */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sidebar Background
                        </label>
                        <input
                            type="text"
                            value={formData.sidebar_bg}
                            onChange={(e) => setFormData({ ...formData, sidebar_bg: e.target.value })}
                            disabled={!canEdit}
                            placeholder="e.g., #667eea or linear-gradient(...)"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Use hex color or CSS gradient
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sidebar Text Color
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="color"
                                value={formData.sidebar_text}
                                onChange={(e) => setFormData({ ...formData, sidebar_text: e.target.value })}
                                disabled={!canEdit}
                                className="h-10 w-20 rounded border border-gray-300 cursor-pointer disabled:opacity-50"
                            />
                            <input
                                type="text"
                                value={formData.sidebar_text}
                                onChange={(e) => setFormData({ ...formData, sidebar_text: e.target.value })}
                                disabled={!canEdit}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                            />
                        </div>
                    </div>
                </div>

                {/* Typography & Borders */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Font Family
                        </label>
                        <select
                            value={formData.font_family}
                            onChange={(e) => setFormData({ ...formData, font_family: e.target.value })}
                            disabled={!canEdit}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        >
                            {FONT_OPTIONS.map((font) => (
                                <option key={font.value} value={font.value}>
                                    {font.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Border Radius
                        </label>
                        <select
                            value={formData.border_radius}
                            onChange={(e) => setFormData({ ...formData, border_radius: e.target.value })}
                            disabled={!canEdit}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        >
                            {BORDER_RADIUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Live Preview Info */}
                <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                    <p className="text-sm text-purple-800">
                        <strong>Live Preview:</strong> Changes are previewed in real-time.
                        Click "Save Changes" to persist your theme settings.
                    </p>
                </div>
            </div>
        </div>
    );
}
