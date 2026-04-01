/**
 * Permissions Page
 * Roles and permissions management with permission matrix
 */

'use client';

import { useState } from 'react';
import { useRoles, useRoleWithPermissions, usePermissionsByCategory, useUpdateRolePermissions } from '@/modules/settings/hooks/use-permissions';
import { usePermission } from '@/hooks/use-permission';
import { Save, Shield } from 'lucide-react';

export default function PermissionsPage() {
    const { data: roles = [] } = useRoles();
    const { data: permissionsByCategory = {} } = usePermissionsByCategory();
    const updatePermissions = useUpdateRolePermissions();
    const { hasPermission: canEdit } = usePermission('settings.permissions.edit');

    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const { data: selectedRole } = useRoleWithPermissions(selectedRoleId);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

    // Update selected permissions when role changes
    useState(() => {
        if (selectedRole) {
            setSelectedPermissions(selectedRole.permissions.map(p => p.id));
        }
    });

    const handleRoleSelect = (roleId: string) => {
        setSelectedRoleId(roleId);
    };

    const handlePermissionToggle = (permissionId: string) => {
        if (!canEdit) return;

        setSelectedPermissions(prev =>
            prev.includes(permissionId)
                ? prev.filter(id => id !== permissionId)
                : [...prev, permissionId]
        );
    };

    const handleSave = async () => {
        if (!selectedRoleId) return;
        await updatePermissions.mutateAsync({
            roleId: selectedRoleId,
            permissionIds: selectedPermissions,
        });
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Roles & Permissions</h2>
                <p className="mt-1 text-sm text-gray-600">
                    Configure page-level access control for each role
                </p>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Roles List */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Roles</h3>
                    <div className="space-y-2">
                        {roles.map((role) => (
                            <button
                                key={role.id}
                                onClick={() => handleRoleSelect(role.id)}
                                className={`
                  w-full text-left px-3 py-2 rounded-md text-sm font-medium transition
                  ${selectedRoleId === role.id
                                        ? 'bg-purple-50 text-purple-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }
                `}
                            >
                                <div className="flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    {role.name}
                                </div>
                                {role.is_system && (
                                    <span className="text-xs text-gray-500">System Role</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Permission Matrix */}
                <div className="col-span-2 bg-white border border-gray-200 rounded-lg p-4">
                    {selectedRole ? (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-semibold text-gray-900">
                                    Permissions for {selectedRole.name}
                                </h3>
                                {canEdit && !selectedRole.is_system && (
                                    <button
                                        onClick={handleSave}
                                        disabled={updatePermissions.isPending}
                                        className="px-3 py-1 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        {updatePermissions.isPending ? 'Saving...' : 'Save'}
                                    </button>
                                )}
                            </div>

                            {selectedRole.is_system && (
                                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-sm text-yellow-800">
                                        System roles cannot be modified. Create a custom role to change permissions.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-6 max-h-[600px] overflow-y-auto">
                                {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                                    <div key={category}>
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                            {category}
                                        </h4>
                                        <div className="space-y-2">
                                            {permissions.map((permission) => {
                                                const isSelected = selectedPermissions.includes(permission.id);
                                                const isDisabled = !canEdit || selectedRole.is_system;

                                                return (
                                                    <label
                                                        key={permission.id}
                                                        className={`
                              flex items-center gap-3 p-3 rounded-md border transition cursor-pointer
                              ${isSelected
                                                                ? 'bg-purple-50 border-purple-200'
                                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                                            }
                              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handlePermissionToggle(permission.id)}
                                                            disabled={isDisabled}
                                                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {permission.name}
                                                            </div>
                                                            {permission.description && (
                                                                <div className="text-xs text-gray-500">
                                                                    {permission.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-64 text-gray-500">
                            Select a role to view permissions
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
