'use client';

import { useEffect, useState } from 'react';
import { combosService } from '../services/combos.service';
import type { Combo } from '@/types/combos';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Package, Plus, Edit2, Power, PowerOff, RefreshCw } from 'lucide-react';
import { proxyImageUrl } from '@/lib/supabase-url';

interface ComboListProps {
    onCreate: () => void;
    onEdit: (id: number) => void;
}

export default function ComboList({ onCreate, onEdit }: ComboListProps) {
    const [combos, setCombos] = useState<Combo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadCombos();
    }, []);

    async function loadCombos() {
        try {
            setLoading(true);
            const data = await combosService.fetchCombos();
            setCombos(data);
        } catch (error) {
            console.error('Failed to load combos:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleDisable(id: number) {
        if (!confirm('Are you sure you want to disable this combo?')) return;

        try {
            await combosService.disableCombo(id);
            await loadCombos();
        } catch (error) {
            console.error('Failed to disable combo:', error);
            alert('Failed to disable combo');
        }
    }

    async function handleEnable(id: number) {
        try {
            await combosService.enableCombo(id);
            await loadCombos();
        } catch (error) {
            console.error('Failed to enable combo:', error);
            alert('Failed to enable combo');
        }
    }

    const filteredCombos = combos.filter((combo) =>
        combo.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        combo.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeCombos = combos.filter(c => c.is_active).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">Combos</h2>
                    <p className="text-gray-600 mt-1">Manage product combos ({combos.length} total)</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={loadCombos}
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                    <Button
                        onClick={onCreate}
                        className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                    >
                        <Plus className="h-4 w-4" />
                        Create Combo
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Combos</p>
                                <p className="text-2xl font-bold mt-1">{combos.length}</p>
                            </div>
                            <div className="bg-indigo-50 p-3 rounded-lg">
                                <Package className="h-6 w-6 text-indigo-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active</p>
                                <p className="text-2xl font-bold mt-1">{activeCombos}</p>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg">
                                <Package className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Inactive</p>
                                <p className="text-2xl font-bold mt-1">{combos.length - activeCombos}</p>
                            </div>
                            <div className="bg-red-50 p-3 rounded-lg">
                                <Package className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Combos Table */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>All Combos</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search combos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ID
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        SKU
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Sale Price
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Regular Price
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredCombos.map((combo) => (
                                    <tr key={combo.combo_id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-mono text-sm text-gray-600">#{combo.combo_id}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                {combo.image_url && (
                                                    <img
                                                        src={proxyImageUrl(combo.image_url)}
                                                        alt={combo.name}
                                                        className="w-10 h-10 rounded-lg object-cover"
                                                    />
                                                )}
                                                <p className="font-medium text-gray-900">{combo.name}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-mono text-sm">{combo.sku}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-semibold text-gray-900">₹{combo.saleprice?.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-gray-600">₹{combo.regularprice?.toLocaleString()}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Badge
                                                variant="outline"
                                                className={
                                                    combo.is_active
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-red-50 text-red-700 border-red-200'
                                                }
                                            >
                                                {combo.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onEdit(combo.combo_id)}
                                                    className="gap-1"
                                                >
                                                    <Edit2 className="h-3 w-3" />
                                                    Edit
                                                </Button>
                                                {combo.is_active ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleDisable(combo.combo_id)}
                                                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    >
                                                        <PowerOff className="h-3 w-3" />
                                                        Disable
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEnable(combo.combo_id)}
                                                        className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    >
                                                        <Power className="h-3 w-3" />
                                                        Enable
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredCombos.length === 0 && (
                            <div className="text-center py-12 text-gray-500">
                                {searchTerm ? 'No combos found matching your search' : 'No combos yet. Create your first combo!'}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
