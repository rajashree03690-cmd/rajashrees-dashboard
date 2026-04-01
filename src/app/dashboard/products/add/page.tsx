'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import {
    ArrowLeft,
    Save,
    Package,
    Upload,
    X,
    Plus,
    Trash2,
    Sparkles,
    AlertTriangle,
    Check,
    Loader2,
    Edit2,
    ChevronDown,
    ChevronUp,
    Settings2
} from 'lucide-react';
import { productsApiService } from '@/modules/products/services/products-api.service';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// Category-specific variant sizes
const BANGLE_SIZES = ['2.4', '2.6', '2.8', '2.10'];
const ANKLET_SIZES = ['7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11'];

// Category IDs (from live database)
const BANGLES_CATEGORY_ID = '3';
const ANKLETS_CATEGORY_ID = '15';

interface Category {
    category_id: number;
    category_name: string;
    subcategories?: Subcategory[];
}

interface Subcategory {
    subcategory_id: number;
    name: string;
    category_id: number;
}

interface VariantSize {
    size: string;
    enabled: boolean;
    stock: number;
    salePrice: number;
}

export default function AddProductPage() {
    const router = useRouter();

    // Form state
    const [productName, setProductName] = useState('');
    const [description, setDescription] = useState('');
    const [shortDescription, setShortDescription] = useState('');
    const [category, setCategory] = useState<string>('');
    const [subcategory, setSubcategory] = useState<string>('');
    const [sku, setSku] = useState('');
    const [isActive, setIsActive] = useState(true);

    // Pricing state (for non-variant products)
    const [salePrice, setSalePrice] = useState('');
    const [regularPrice, setRegularPrice] = useState('');
    const [stockQty, setStockQty] = useState('');
    const [weight, setWeight] = useState('');

    // Variant state
    const [hasVariants, setHasVariants] = useState(false);
    const [variantSizes, setVariantSizes] = useState<VariantSize[]>([]);
    const [sizeType, setSizeType] = useState<'none' | 'free' | 'multiple'>('none');

    // Image state
    const [images, setImages] = useState<{ url: string; file?: File }[]>([]);
    const [imageError, setImageError] = useState('');

    // Data from API
    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [filteredSubcategories, setFilteredSubcategories] = useState<Subcategory[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

    // Inline add states
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [addingCategory, setAddingCategory] = useState(false);
    const [showAddSubcategory, setShowAddSubcategory] = useState(false);
    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [addingSubcategory, setAddingSubcategory] = useState(false);

    // Edit states
    const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
    const [editCategoryName, setEditCategoryName] = useState('');
    const [savingCategoryEdit, setSavingCategoryEdit] = useState(false);
    const [editingSubcategoryId, setEditingSubcategoryId] = useState<number | null>(null);
    const [editSubcategoryName, setEditSubcategoryName] = useState('');
    const [savingSubcategoryEdit, setSavingSubcategoryEdit] = useState(false);

    // Manage sections toggle
    const [showManageCategories, setShowManageCategories] = useState(false);
    const [showManageSubcategories, setShowManageSubcategories] = useState(false);
    const [validationError, setValidationError] = useState('');

    // Fetch categories and subcategories
    const fetchCategoriesData = async () => {
        try {
            const response = await fetch('/api/categories-with-subcategories');
            if (response.ok) {
                const data = await response.json();
                setCategories(data);
                console.log('✅ Categories with subcategories loaded:', data);
            } else {
                console.error('Failed to load categories:', response.status);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    useEffect(() => {
        fetchCategoriesData();
    }, []);

    // Add new category inline
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        setAddingCategory(true);
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCategoryName.trim() }),
            });
            if (res.ok) {
                const created = await res.json();
                await fetchCategoriesData();
                // Auto-select the new category
                setCategory(created.id?.toString() || '');
                setNewCategoryName('');
                setShowAddCategory(false);
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to add category');
            }
        } catch (err) {
            console.error('Error adding category:', err);
            alert('Failed to add category');
        } finally {
            setAddingCategory(false);
        }
    };

    // Add new subcategory inline
    const handleAddSubcategory = async () => {
        if (!newSubcategoryName.trim() || !category) return;
        setAddingSubcategory(true);
        try {
            const res = await fetch('/api/subcategories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSubcategoryName.trim(), category_id: parseInt(category) }),
            });
            if (res.ok) {
                const created = await res.json();
                await fetchCategoriesData();
                // Auto-select the new subcategory
                setSubcategory(created.subcategory_id?.toString() || '');
                setNewSubcategoryName('');
                setShowAddSubcategory(false);
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to add subcategory');
            }
        } catch (err) {
            console.error('Error adding subcategory:', err);
            alert('Failed to add subcategory');
        } finally {
            setAddingSubcategory(false);
        }
    };

    // Edit category (rename)
    const handleEditCategory = async (catId: number) => {
        if (!editCategoryName.trim()) return;
        setSavingCategoryEdit(true);
        try {
            const res = await fetch('/api/categories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: catId, name: editCategoryName.trim() }),
            });
            if (res.ok) {
                await fetchCategoriesData();
                setEditingCategoryId(null);
                setEditCategoryName('');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to update category');
            }
        } catch (err) {
            console.error('Error updating category:', err);
            alert('Failed to update category');
        } finally {
            setSavingCategoryEdit(false);
        }
    };


    // Edit subcategory (rename)
    const handleEditSubcategory = async (subId: number) => {
        if (!editSubcategoryName.trim()) return;
        setSavingSubcategoryEdit(true);
        try {
            const res = await fetch('/api/subcategories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subcategory_id: subId, name: editSubcategoryName.trim() }),
            });
            if (res.ok) {
                await fetchCategoriesData();
                setEditingSubcategoryId(null);
                setEditSubcategoryName('');
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to update subcategory');
            }
        } catch (err) {
            console.error('Error updating subcategory:', err);
            alert('Failed to update subcategory');
        } finally {
            setSavingSubcategoryEdit(false);
        }
    };


    // Filter subcategories based on selected category
    useEffect(() => {
        if (category) {
            const selectedCat = categories.find(c => c.category_id === parseInt(category));
            setFilteredSubcategories(selectedCat?.subcategories || []);
        } else {
            setFilteredSubcategories([]);
        }
    }, [category, categories]);

    // Auto-enable variants for Bangles and Anklets with correct sizes
    useEffect(() => {
        let sizes: string[] = [];
        if (category === BANGLES_CATEGORY_ID) {
            sizes = BANGLE_SIZES;
        } else if (category === ANKLETS_CATEGORY_ID) {
            sizes = ANKLET_SIZES;
        }

        if (sizes.length > 0) {
            setHasVariants(true);
            setSizeType('multiple');
            setVariantSizes(sizes.map(size => ({
                size,
                enabled: true,
                stock: 0,
                salePrice: 0
            })));
        } else {
            setHasVariants(false);
            setSizeType('none');
            setVariantSizes([]);
        }
    }, [category]);

    // Handle size type change
    const handleSizeTypeChange = (type: 'none' | 'free' | 'multiple') => {
        setSizeType(type);
        if (type === 'none') {
            setHasVariants(false);
            setVariantSizes([]);
        } else if (type === 'free') {
            setHasVariants(true);
            setVariantSizes([{ size: 'Free Size', enabled: true, stock: 0, salePrice: 0 }]);
        } else {
            setHasVariants(true);
            let sizes: string[] = [];
            if (category === BANGLES_CATEGORY_ID) sizes = BANGLE_SIZES;
            else if (category === ANKLETS_CATEGORY_ID) sizes = ANKLET_SIZES;
            if (sizes.length > 0) {
                setVariantSizes(sizes.map(size => ({ size, enabled: true, stock: 0, salePrice: 0 })));
            }
        }
    };

    // Select all / deselect all sizes
    const handleSelectAllSizes = (enabled: boolean) => {
        setVariantSizes(prev => prev.map(v => ({ ...v, enabled })));
    };

    // Handle image upload with 1-3 limit
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const MAX_IMAGES = 3;
        const remainingSlots = MAX_IMAGES - images.length;

        if (remainingSlots <= 0) {
            setImageError(`Maximum ${MAX_IMAGES} images allowed`);
            return;
        }

        setImageError('');
        const filesToAdd = Array.from(files).slice(0, remainingSlots);

        filesToAdd.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImages(prev => {
                    if (prev.length >= MAX_IMAGES) return prev;
                    return [...prev, { url: reader.result as string, file }];
                });
            };
            reader.readAsDataURL(file);
        });
    };

    // Remove image
    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    // Toggle variant size
    const toggleVariantSize = (size: string) => {
        setVariantSizes(prev =>
            prev.map(v => v.size === size ? { ...v, enabled: !v.enabled } : v)
        );
    };

    // Update variant data
    const updateVariant = (size: string, field: 'stock' | 'salePrice', value: number) => {
        setVariantSizes(prev =>
            prev.map(v => v.size === size ? { ...v, [field]: value } : v)
        );
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Validate required fields
        if (!productName.trim()) {
            setValidationError('Product name is required');
            toast.error('Product name is required');
            setSaveStatus('error');
            return;
        }
        if (!sku.trim()) {
            setValidationError('SKU is required');
            toast.error('SKU is required');
            setSaveStatus('error');
            return;
        }
        if (!category) {
            setValidationError('Please select a category');
            toast.error('Please select a category');
            setSaveStatus('error');
            return;
        }
        if (!subcategory) {
            setValidationError('Please select a subcategory');
            toast.error('Please select a subcategory');
            setSaveStatus('error');
            return;
        }

        // Validate pricing for non-variant products
        if (!hasVariants && category !== BANGLES_CATEGORY_ID && category !== ANKLETS_CATEGORY_ID) {
            if (!salePrice || parseFloat(salePrice) <= 0) {
                setValidationError('Sale price is required and must be greater than 0');
                toast.error('Sale price is required');
                setSaveStatus('error');
                return;
            }
            if (!stockQty || parseInt(stockQty) < 0) {
                setValidationError('Stock quantity is required');
                toast.error('Stock quantity is required');
                setSaveStatus('error');
                return;
            }
        }

        // Validate variant stock for variant products
        if (hasVariants) {
            const enabledVariants = variantSizes.filter(v => v.enabled);
            if (enabledVariants.length === 0) {
                setValidationError('At least one variant size must be enabled');
                toast.error('Enable at least one variant size');
                setSaveStatus('error');
                return;
            }
        }

        try {
            // For non-variant products, create a single default variant with the pricing info
            const defaultVariant = !hasVariants ? [{
                variant_name: productName,
                sku: sku,
                sale_price: parseFloat(salePrice) || 0,
                regular_price: parseFloat(regularPrice) || 0,
                stock: parseInt(stockQty) || 0,
                weight: parseFloat(weight) || 0,
            }] : [];

            const productData = {
                name: productName,
                description,
                short_description: shortDescription,
                category_id: parseInt(category),
                subcategory_id: parseInt(subcategory),
                sku,
                is_active: isActive,
                has_variant: hasVariants,
                images: images.map(img => img.url),
                variants: hasVariants ? variantSizes.filter(v => v.enabled).map(v => ({
                    size: v.size,
                    stock: v.stock,
                    sale_price: v.salePrice,
                    variant_name: `${productName} - Size ${v.size}`
                })) : defaultVariant
            };

            const result = await productsApiService.createProductWithVariants(productData);

            if (result.success) {
                setSaveStatus('success');
                toast.success('Product Created Successfully! 🎉');
                setTimeout(() => {
                    router.push('/dashboard/products');
                }, 1500);
            } else {
                setSaveStatus('error');
                const errorMsg = result.error || 'Failed to create product';
                setValidationError(errorMsg);
                toast.error(errorMsg);
            }
        } catch (error: any) {
            console.error('Error creating product:', error);
            setSaveStatus('error');
            const errorMsg = error?.message || 'An unexpected error occurred while creating the product';
            setValidationError(errorMsg);
            toast.error(errorMsg);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => router.back()}
                            className="rounded-full hover:bg-white/80 transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                Add New Product
                            </h1>
                            <p className="text-slate-600 mt-1">Create a new product in your catalog</p>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => router.back()}
                            className="rounded-full border-slate-200 hover:bg-slate-50"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={saveStatus === 'saving' || !productName || !category}
                            className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 transition-all"
                        >
                            {saveStatus === 'saving' ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : saveStatus === 'success' ? (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Saved Successfully!
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Save Product
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
                {/* Error Display */}
                {(validationError || imageError) && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-red-900">Validation Error</h4>
                            <p className="text-red-700 text-sm mt-1">{validationError || imageError}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Basic Information */}
                        <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow">
                            <CardContent className="p-8">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                                        <Package className="w-5 h-5 text-white" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-slate-900">Basic Information</h2>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <Label htmlFor="name" className="text-sm font-medium text-slate-700">
                                            Product Name *
                                        </Label>
                                        <Input
                                            id="name"
                                            value={productName}
                                            onChange={(e) => setProductName(e.target.value)}
                                            placeholder="Enter product name..."
                                            className="mt-2 h-12 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="sku" className="text-sm font-medium text-slate-700">
                                            SKU *
                                        </Label>
                                        <Input
                                            id="sku"
                                            value={sku}
                                            onChange={(e) => setSku(e.target.value)}
                                            placeholder="e.g., RFP-B1001"
                                            className="mt-2 h-12 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="shortDesc" className="text-sm font-medium text-slate-700">
                                            Short Description
                                        </Label>
                                        <Textarea
                                            id="shortDesc"
                                            value={shortDescription}
                                            onChange={(e) => setShortDescription(e.target.value)}
                                            placeholder="Brief description (optional)..."
                                            rows={3}
                                            className="mt-2 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="description" className="text-sm font-medium text-slate-700">
                                            Full Description
                                        </Label>
                                        <Textarea
                                            id="description"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Detailed product description..."
                                            rows={6}
                                            className="mt-2 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Product Images */}
                        <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow">
                            <CardContent className="p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-semibold text-slate-900">Product Images</h2>
                                    <label htmlFor="image-upload">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="rounded-full"
                                            onClick={() => document.getElementById('image-upload')?.click()}
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Upload Images
                                        </Button>
                                    </label>
                                    <input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </div>

                                {images.length === 0 ? (
                                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                                        <Upload className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                                        <p className="text-slate-500">Click "Upload Images" to add product photos</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {images.map((image, index) => (
                                            <div key={index} className="relative group">
                                                <img
                                                    src={image.url}
                                                    alt={`Product ${index + 1}`}
                                                    className="w-full h-32 object-cover rounded-xl border border-slate-200"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
                                                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                {index === 0 && (
                                                    <Badge className="absolute bottom-2 left-2 bg-blue-500 text-white">
                                                        Primary
                                                    </Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Size / Variant Section */}
                        {(category === BANGLES_CATEGORY_ID || category === ANKLETS_CATEGORY_ID) && (
                            <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow">
                                <CardContent className="p-8">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                            <Sparkles className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-slate-900">
                                                {category === BANGLES_CATEGORY_ID ? 'Bangle' : 'Anklet'} Sizes
                                            </h2>
                                            <p className="text-sm text-slate-600">Select size type and configure available sizes</p>
                                        </div>
                                    </div>

                                    {/* Size Type Selector */}
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        <button
                                            type="button"
                                            onClick={() => handleSizeTypeChange('none')}
                                            className={`p-3 rounded-xl border-2 text-center transition-all ${sizeType === 'none'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                                }`}
                                        >
                                            <X className="w-5 h-5 mx-auto mb-1" />
                                            <span className="text-xs font-medium">No Size</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSizeTypeChange('free')}
                                            className={`p-3 rounded-xl border-2 text-center transition-all ${sizeType === 'free'
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                                }`}
                                        >
                                            <Package className="w-5 h-5 mx-auto mb-1" />
                                            <span className="text-xs font-medium">Free Size</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSizeTypeChange('multiple')}
                                            className={`p-3 rounded-xl border-2 text-center transition-all ${sizeType === 'multiple'
                                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                                : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                                }`}
                                        >
                                            <Sparkles className="w-5 h-5 mx-auto mb-1" />
                                            <span className="text-xs font-medium">Multiple Sizes</span>
                                        </button>
                                    </div>

                                    {/* Free Size - single variant */}
                                    {sizeType === 'free' && variantSizes.length > 0 && (
                                        <div className="p-4 rounded-xl border-2 border-green-400 bg-green-50">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Package className="w-4 h-4 text-green-600" />
                                                <span className="font-semibold text-green-900">Free Size (One Size Fits All)</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <Label className="text-xs text-slate-600">Stock</Label>
                                                    <Input
                                                        type="number"
                                                        value={variantSizes[0]?.stock || 0}
                                                        onChange={(e) => updateVariant('Free Size', 'stock', parseInt(e.target.value) || 0)}
                                                        className="h-9 mt-1 text-sm rounded-lg"
                                                        min="0"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs text-slate-600">Price (₹)</Label>
                                                    <Input
                                                        type="number"
                                                        value={variantSizes[0]?.salePrice || 0}
                                                        onChange={(e) => updateVariant('Free Size', 'salePrice', parseFloat(e.target.value) || 0)}
                                                        className="h-9 mt-1 text-sm rounded-lg"
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* No Size info */}
                                    {sizeType === 'none' && (
                                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center">
                                            <p className="text-sm text-slate-600">This product will have no size variants.</p>
                                            <p className="text-xs text-slate-400 mt-1">Stock and price will be set at product level.</p>
                                        </div>
                                    )}

                                    {/* Multiple Sizes */}
                                    {sizeType === 'multiple' && variantSizes.length > 0 && (
                                        <>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-sm text-slate-600">
                                                    {variantSizes.filter(v => v.enabled).length} of {variantSizes.length} sizes selected
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectAllSizes(true)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                                    >
                                                        Select All
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectAllSizes(false)}
                                                        className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                                                    >
                                                        Deselect All
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {variantSizes.map((variant) => (
                                                    <div
                                                        key={variant.size}
                                                        className={`p-4 rounded-xl border-2 transition-all ${variant.enabled
                                                            ? 'border-blue-500 bg-blue-50'
                                                            : 'border-slate-200 bg-slate-50 opacity-60'
                                                            }`}
                                                    >
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="font-semibold text-slate-900">Size {variant.size}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleVariantSize(variant.size)}
                                                                className={`w-10 h-6 rounded-full transition-all ${variant.enabled ? 'bg-blue-500' : 'bg-slate-300'
                                                                    }`}
                                                            >
                                                                <div
                                                                    className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${variant.enabled ? 'translate-x-4' : 'translate-x-0.5'
                                                                        }`}
                                                                />
                                                            </button>
                                                        </div>

                                                        {variant.enabled && (
                                                            <div className="space-y-2">
                                                                <div>
                                                                    <Label className="text-xs text-slate-600">Stock</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={variant.stock}
                                                                        onChange={(e) =>
                                                                            updateVariant(variant.size, 'stock', parseInt(e.target.value) || 0)
                                                                        }
                                                                        className="h-9 mt-1 text-sm rounded-lg"
                                                                        min="0"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-xs text-slate-600">Price (₹)</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={variant.salePrice}
                                                                        onChange={(e) =>
                                                                            updateVariant(variant.size, 'salePrice', parseFloat(e.target.value) || 0)
                                                                        }
                                                                        className="h-9 mt-1 text-sm rounded-lg"
                                                                        min="0"
                                                                        step="0.01"
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                                                <p className="text-sm text-blue-900">
                                                    <strong>Enabled sizes:</strong>{' '}
                                                    {variantSizes.filter(v => v.enabled).map(v => v.size).join(', ') || 'None'}
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Pricing & Stock (for non-variant products) */}
                        {!hasVariants && category !== BANGLES_CATEGORY_ID && category !== ANKLETS_CATEGORY_ID && (
                            <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow">
                                <CardContent className="p-8">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                            <span className="text-white text-lg font-bold">₹</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-semibold text-slate-900">Pricing & Stock</h2>
                                            <p className="text-sm text-slate-500">Set the price and availability</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <Label htmlFor="sale-price" className="text-sm font-medium text-slate-700">Sale Price *</Label>
                                            <Input
                                                id="sale-price"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={salePrice}
                                                onChange={(e) => setSalePrice(e.target.value)}
                                                placeholder="0.00"
                                                className="mt-2 h-11 rounded-xl border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="regular-price" className="text-sm font-medium text-slate-700">Regular Price</Label>
                                            <Input
                                                id="regular-price"
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={regularPrice}
                                                onChange={(e) => setRegularPrice(e.target.value)}
                                                placeholder="0.00"
                                                className="mt-2 h-11 rounded-xl border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="stock-qty" className="text-sm font-medium text-slate-700">Stock Qty *</Label>
                                            <Input
                                                id="stock-qty"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={stockQty}
                                                onChange={(e) => setStockQty(e.target.value)}
                                                placeholder="0"
                                                className="mt-2 h-11 rounded-xl border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="weight" className="text-sm font-medium text-slate-700">Weight (g)</Label>
                                            <Input
                                                id="weight"
                                                type="number"
                                                min="0"
                                                value={weight}
                                                onChange={(e) => setWeight(e.target.value)}
                                                placeholder="0"
                                                className="mt-2 h-11 rounded-xl border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Category Selection */}
                        <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow sticky top-6">
                            <CardContent className="p-6">
                                <h3 className="font-semibold text-slate-900 mb-4">Category & Organization</h3>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-medium text-slate-700">Category *</Label>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddCategory(!showAddCategory)}
                                                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Add New
                                            </button>
                                        </div>
                                        {showAddCategory && (
                                            <div className="mt-2 flex gap-2">
                                                <Input
                                                    value={newCategoryName}
                                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                                    placeholder="New category name..."
                                                    className="h-9 rounded-lg text-sm flex-1"
                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
                                                    autoFocus
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={handleAddCategory}
                                                    disabled={addingCategory || !newCategoryName.trim()}
                                                    className="h-9 px-3 rounded-lg bg-green-600 hover:bg-green-700"
                                                >
                                                    {addingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => { setShowAddCategory(false); setNewCategoryName(''); }}
                                                    className="h-9 px-3 rounded-lg"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                        <Select value={category} onValueChange={setCategory}>
                                            <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200">
                                                <SelectValue placeholder="Select category..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((cat) => (
                                                    <SelectItem key={cat.category_id} value={cat.category_id.toString()}>
                                                        {cat.category_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-medium text-slate-700">Subcategory *</Label>
                                            {category && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAddSubcategory(!showAddSubcategory)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Add New
                                                </button>
                                            )}
                                        </div>
                                        {showAddSubcategory && category && (
                                            <div className="mt-2 flex gap-2">
                                                <Input
                                                    value={newSubcategoryName}
                                                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                                                    placeholder="New subcategory name..."
                                                    className="h-9 rounded-lg text-sm flex-1"
                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSubcategory())}
                                                    autoFocus
                                                />
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={handleAddSubcategory}
                                                    disabled={addingSubcategory || !newSubcategoryName.trim()}
                                                    className="h-9 px-3 rounded-lg bg-green-600 hover:bg-green-700"
                                                >
                                                    {addingSubcategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => { setShowAddSubcategory(false); setNewSubcategoryName(''); }}
                                                    className="h-9 px-3 rounded-lg"
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                        <Select
                                            value={subcategory}
                                            onValueChange={setSubcategory}
                                            disabled={!category}
                                        >
                                            <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200">
                                                <SelectValue placeholder="Select subcategory..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {filteredSubcategories.map((sub) => (
                                                    <SelectItem key={sub.subcategory_id} value={sub.subcategory_id.toString()}>
                                                        {sub.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(category === BANGLES_CATEGORY_ID || category === ANKLETS_CATEGORY_ID) && (
                                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                                            <div className="flex items-start gap-2">
                                                <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                                                <div className="text-xs text-purple-900">
                                                    <strong>
                                                        {category === BANGLES_CATEGORY_ID ? 'Bangles' : 'Anklets'} Category:
                                                    </strong>{' '}
                                                    Variant sizes ({category === BANGLES_CATEGORY_ID ? BANGLE_SIZES.join(', ') : ANKLET_SIZES.join(', ')}) enabled automatically
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm font-medium text-slate-700">Active Status</Label>
                                            <button
                                                type="button"
                                                onClick={() => setIsActive(!isActive)}
                                                className={`w-12 h-7 rounded-full transition-all ${isActive ? 'bg-green-500' : 'bg-slate-300'
                                                    }`}
                                            >
                                                <div
                                                    className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform ${isActive ? 'translate-x-5' : 'translate-x-0.5'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            {isActive ? 'Product will be visible on the website' : 'Product will be hidden'}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Manage Categories Card */}
                        <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow">
                            <CardContent className="p-6">
                                <button
                                    type="button"
                                    onClick={() => setShowManageCategories(!showManageCategories)}
                                    className="flex items-center justify-between w-full text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <Settings2 className="w-4 h-4 text-slate-500" />
                                        <h3 className="font-semibold text-slate-900 text-sm">Manage Categories</h3>
                                    </div>
                                    {showManageCategories ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                </button>

                                {showManageCategories && (
                                    <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                                        {categories.length === 0 ? (
                                            <p className="text-sm text-slate-500 text-center py-4">No categories yet</p>
                                        ) : (
                                            categories.map((cat) => {
                                                const isEditing = editingCategoryId === cat.category_id;
                                                return (
                                                    <div key={cat.category_id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all">
                                                        {isEditing ? (
                                                            <>
                                                                <Input
                                                                    value={editCategoryName}
                                                                    onChange={(e) => setEditCategoryName(e.target.value)}
                                                                    className="h-8 text-sm flex-1"
                                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleEditCategory(cat.category_id))}
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEditCategory(cat.category_id)}
                                                                    disabled={savingCategoryEdit}
                                                                    className="p-1 rounded bg-green-600 text-white hover:bg-green-700"
                                                                >
                                                                    {savingCategoryEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setEditingCategoryId(null); setEditCategoryName(''); }}
                                                                    className="p-1 rounded text-slate-500 hover:bg-slate-200"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="flex-1 text-sm font-medium truncate">{cat.category_name}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setEditingCategoryId(cat.category_id); setEditCategoryName(cat.category_name); }}
                                                                    className="p-1 rounded text-blue-600 hover:bg-blue-100 transition-colors"
                                                                    title="Rename"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Manage Subcategories Card */}
                        {category && (
                            <Card className="border-0 shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow">
                                <CardContent className="p-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowManageSubcategories(!showManageSubcategories)}
                                        className="flex items-center justify-between w-full text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Settings2 className="w-4 h-4 text-slate-500" />
                                            <h3 className="font-semibold text-slate-900 text-sm">Manage Subcategories</h3>
                                        </div>
                                        {showManageSubcategories ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </button>

                                    {showManageSubcategories && (
                                        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                                            {filteredSubcategories.length === 0 ? (
                                                <p className="text-sm text-slate-500 text-center py-4">No subcategories for this category</p>
                                            ) : (
                                                filteredSubcategories.map((sub) => {
                                                    const isEditing = editingSubcategoryId === sub.subcategory_id;
                                                    return (
                                                        <div key={sub.subcategory_id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all">
                                                            {isEditing ? (
                                                                <>
                                                                    <Input
                                                                        value={editSubcategoryName}
                                                                        onChange={(e) => setEditSubcategoryName(e.target.value)}
                                                                        className="h-8 text-sm flex-1"
                                                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleEditSubcategory(sub.subcategory_id))}
                                                                        autoFocus
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleEditSubcategory(sub.subcategory_id)}
                                                                        disabled={savingSubcategoryEdit}
                                                                        className="p-1 rounded bg-green-600 text-white hover:bg-green-700"
                                                                    >
                                                                        {savingSubcategoryEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setEditingSubcategoryId(null); setEditSubcategoryName(''); }}
                                                                        className="p-1 rounded text-slate-500 hover:bg-slate-200"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="flex-1 text-sm font-medium truncate">{sub.name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setEditingSubcategoryId(sub.subcategory_id); setEditSubcategoryName(sub.name); }}
                                                                        className="p-1 rounded text-blue-600 hover:bg-blue-100 transition-colors"
                                                                        title="Rename"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}
