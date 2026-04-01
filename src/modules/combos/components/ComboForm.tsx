'use client';

import { useEffect, useState } from 'react';
import { combosService } from '../services/combos.service';
import { productsService } from '@/modules/products/services/products.service';
import type { ComboItemInput } from '@/types/combos';
import type { ProductVariant } from '@/types/products';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Plus, Trash2, Search } from 'lucide-react';

interface ComboFormProps {
    comboId: number | null;
    onBack: () => void;
}

export default function ComboForm({ comboId, onBack }: ComboFormProps) {
    const isEdit = !!comboId;

    // Form state
    const [name, setName] = useState('');
    const [sku, setSku] = useState('');
    const [saleprice, setSaleprice] = useState('');
    const [regularprice, setRegularprice] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [items, setItems] = useState<ComboItemInput[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [variants, setVariants] = useState<ProductVariant[]>([]);
    const [showVariantSelector, setShowVariantSelector] = useState(false);
    const [variantSearch, setVariantSearch] = useState('');

    useEffect(() => {
        loadVariants();
        if (isEdit) {
            loadCombo();
        }
    }, []);

    async function loadVariants() {
        try {
            const data = await productsService.fetchProductVariants();
            setVariants(data);
        } catch (error) {
            console.error('Failed to load variants:', error);
        }
    }

    async function loadCombo() {
        if (!comboId) return;

        try {
            setLoadingData(true);
            const { combo, items: comboItems } = await combosService.fetchComboById(comboId);

            setName(combo.name);
            setSku(combo.sku);
            setSaleprice(combo.saleprice.toString());
            setRegularprice(combo.regularprice.toString());
            setDescription(combo.description || '');
            setImageUrl(combo.image_url || '');
            setItems(
                comboItems.map(item => ({
                    variant_id: item.variant_id,
                    quantity_per_combo: item.quantity_per_combo
                }))
            );
        } catch (error) {
            console.error('Failed to load combo:', error);
            alert('Failed to load combo');
        } finally {
            setLoadingData(false);
        }
    }

    async function handleSave() {
        // Validation
        if (!name.trim()) {
            alert('Please enter combo name');
            return;
        }
        if (!sku.trim() && !isEdit) {
            alert('Please enter SKU');
            return;
        }
        if (!saleprice || parseFloat(saleprice) <= 0) {
            alert('Please enter valid sale price');
            return;
        }
        if (!regularprice || parseFloat(regularprice) <= 0) {
            alert('Please enter valid regular price');
            return;
        }
        if (items.length === 0) {
            alert('Please add at least one product variant');
            return;
        }

        try {
            setLoading(true);

            const formData = {
                name,
                sku,
                saleprice: parseFloat(saleprice),
                regularprice: parseFloat(regularprice),
                description,
                image_url: imageUrl,
                items
            };

            if (isEdit && comboId) {
                await combosService.updateCombo(comboId, formData);
            } else {
                await combosService.createCombo(formData);
            }

            onBack();
        } catch (error) {
            console.error('Failed to save combo:', error);
            alert('Failed to save combo');
        } finally {
            setLoading(false);
        }
    }

    function addItem(variantId: number) {
        if (items.some(item => item.variant_id === variantId)) {
            alert('This variant is already added');
            return;
        }
        setItems([...items, { variant_id: variantId, quantity_per_combo: 1 }]);
        setShowVariantSelector(false);
        setVariantSearch('');
    }

    function removeItem(index: number) {
        setItems(items.filter((_, i) => i !== index));
    }

    function updateQuantity(index: number, quantity: number) {
        const newItems = [...items];
        newItems[index].quantity_per_combo = quantity;
        setItems(newItems);
    }

    const filteredVariants = variants.filter(v =>
        v.products?.product_name?.toLowerCase().includes(variantSearch.toLowerCase()) ||
        v.sku?.toLowerCase().includes(variantSearch.toLowerCase())
    );

    if (loadingData) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="outline"
                    onClick={onBack}
                    className="gap-2"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </Button>
                <div>
                    <h2 className="text-3xl font-bold text-gray-900">
                        {isEdit ? 'Edit Combo' : 'Create Combo'}
                    </h2>
                    <p className="text-gray-600 mt-1">
                        {isEdit ? 'Update combo details and items' : 'Add a new combo to your catalog'}
                    </p>
                </div>
            </div>

            {/* Form */}
            <Card>
                <CardHeader>
                    <CardTitle>Combo Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Combo Name *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter combo name"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="sku">SKU *</Label>
                            <Input
                                id="sku"
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                placeholder="Enter SKU"
                                disabled={isEdit}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="saleprice">Sale Price *</Label>
                            <Input
                                id="saleprice"
                                type="number"
                                value={saleprice}
                                onChange={(e) => setSaleprice(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="regularprice">Regular Price *</Label>
                            <Input
                                id="regularprice"
                                type="number"
                                value={regularprice}
                                onChange={(e) => setRegularprice(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter combo description"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="imageUrl">Image URL</Label>
                        <Input
                            id="imageUrl"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Combo Items */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Combo Items</CardTitle>
                        <Button
                            onClick={() => setShowVariantSelector(!showVariantSelector)}
                            className="gap-2"
                            variant="outline"
                        >
                            <Plus className="h-4 w-4" />
                            Add Product Variant
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Variant Selector */}
                    {showVariantSelector && (
                        <div className="border rounded-lg p-4 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search variants..."
                                    value={variantSearch}
                                    onChange={(e) => setVariantSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="max-h-64 overflow-y-auto border rounded">
                                {filteredVariants.map((variant) => (
                                    <div
                                        key={variant.variant_id}
                                        onClick={() => {
                                            const id = variant.variant_id ? Number(variant.variant_id) : 0;
                                            if (id) addItem(id);
                                        }}
                                        className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                                    >
                                        <p className="font-medium">{variant.products?.product_name}</p>
                                        <p className="text-sm text-gray-600">
                                            SKU: {variant.sku} | Stock: {variant.stock_quantity}
                                        </p>
                                    </div>
                                ))}
                                {filteredVariants.length === 0 && (
                                    <div className="px-4 py-8 text-center text-gray-500">
                                        No variants found
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Selected Items */}
                    {items.length > 0 ? (
                        <div className="space-y-2">
                            {items.map((item, index) => {
                                const variant = variants.find(v => Number(v.variant_id) === item.variant_id);
                                return (
                                    <div
                                        key={index}
                                        className="flex items-center gap-4 p-4 border rounded-lg"
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium">{variant?.products?.product_name}</p>
                                            <p className="text-sm text-gray-600">SKU: {variant?.sku}</p>
                                        </div>
                                        <div className="w-24">
                                            <Input
                                                type="number"
                                                value={item.quantity_per_combo}
                                                onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                                                min="1"
                                                className="text-center"
                                            />
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => removeItem(index)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-lg">
                            No items added yet. Click "Add Product Variant" to get started.
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
                <Button
                    variant="outline"
                    onClick={onBack}
                    disabled={loading}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={loading}
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                    <Save className="h-4 w-4" />
                    {loading ? 'Saving...' : 'Save Combo'}
                </Button>
            </div>
        </div>
    );
}
