/**
 * Security Settings Page
 * Password policy and session management
 */

'use client';

import { useState, useEffect } from 'react';
import { useSecuritySettings, useUpdateSecuritySettings } from '@/modules/settings/hooks/use-settings';
import { usePermission } from '@/hooks/use-permission';
import { Save, Lock } from 'lucide-react';

export default function SecurityPage() {
    const { data: settings, isLoading } = useSecuritySettings();
    const updateSettings = useUpdateSecuritySettings();
    const { hasPermission: canEdit } = usePermission('settings.security.edit');

    const [formData, setFormData] = useState({
        password_min_length: 8,
        password_require_uppercase: true,
        password_require_number: true,
        password_require_special: true,
        session_timeout_minutes: 480,
        max_failed_login_attempts: 5,
        lockout_duration_minutes: 30,
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                password_min_length: settings.password_min_length,
                password_require_uppercase: settings.password_require_uppercase,
                password_require_number: settings.password_require_number,
                password_require_special: settings.password_require_special,
                session_timeout_minutes: settings.session_timeout_minutes,
                max_failed_login_attempts: settings.max_failed_login_attempts,
                lockout_duration_minutes: settings.lockout_duration_minutes,
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
                <h2 className="text-2xl font-bold text-gray-900">Security Settings</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Configure password policy and session security
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
                {/* Password Policy */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                        <Lock className="w-5 h-5" />
                        Password Policy
                    </h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Minimum Password Length
                        </label>
                        <input
                            type="number"
                            value={formData.password_min_length}
                            onChange={(e) => setFormData({ ...formData, password_min_length: parseInt(e.target.value) })}
                            disabled={!canEdit}
                            min={6}
                            max={32}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.password_require_uppercase}
                                onChange={(e) => setFormData({ ...formData, password_require_uppercase: e.target.checked })}
                                disabled={!canEdit}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-700">
                                Require uppercase letter
                            </span>
                        </label>

                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.password_require_number}
                                onChange={(e) => setFormData({ ...formData, password_require_number: e.target.checked })}
                                disabled={!canEdit}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-700">
                                Require number
                            </span>
                        </label>

                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={formData.password_require_special}
                                onChange={(e) => setFormData({ ...formData, password_require_special: e.target.checked })}
                                disabled={!canEdit}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-700">
                                Require special character
                            </span>
                        </label>
                    </div>
                </div>

                {/* Session Security */}
                <div className="space-y-4 pt-4 border-t">
                    <h3 className="text-lg font-medium text-gray-900">Session Security</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Session Timeout (minutes)
                        </label>
                        <input
                            type="number"
                            value={formData.session_timeout_minutes}
                            onChange={(e) => setFormData({ ...formData, session_timeout_minutes: parseInt(e.target.value) })}
                            disabled={!canEdit}
                            min={15}
                            max={1440}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Auto-logout after inactivity (15-1440 minutes)
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Max Failed Login Attempts
                        </label>
                        <input
                            type="number"
                            value={formData.max_failed_login_attempts}
                            onChange={(e) => setFormData({ ...formData, max_failed_login_attempts: parseInt(e.target.value) })}
                            disabled={!canEdit}
                            min={3}
                            max={10}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Lockout Duration (minutes)
                        </label>
                        <input
                            type="number"
                            value={formData.lockout_duration_minutes}
                            onChange={(e) => setFormData({ ...formData, lockout_duration_minutes: parseInt(e.target.value) })}
                            disabled={!canEdit}
                            min={5}
                            max={120}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Account lockout duration after max failed attempts
                        </p>
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
