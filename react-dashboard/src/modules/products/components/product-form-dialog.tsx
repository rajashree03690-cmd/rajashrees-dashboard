'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Package, Upload, X } from 'lucide-react';
import { productsApiService } from '@/modules/products/services/products-api.service';

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    initialProduct?: any;
}

export function ProductFormDialog({ open, onOpenChange, onSuccess, initialProduct }: ProductFormDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [sku, setSku] = useState('');
    const [hasVariants, setHasVariants] = useState(false);
    const [salePrice, setSalePrice] = useState('');
    const [regularPrice, setRegularPrice] = useState('');
    const [weight, setWeight] = useState('');

    // Image States
    const [imageUrl, setImageUrl] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);

    const [image2Url, setImage2Url] = useState('');
    const [image2File, setImage2File] = useState<File | null>(null);

    const [image3Url, setImage3Url] = useState('');
    const [image3File, setImage3File] = useState<File | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Category/Subcategory state
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(true);

    // Variants state
    const [variants, setVariants] = useState<any[]>([]);

    useEffect(() => {
        if (initialProduct) {
            setName(initialProduct.name || '');
            setDescription(initialProduct.description || '');
            setSku(initialProduct.sku || '');
            setHasVariants(initialProduct.hasVariant || false);

            // Allow string nulls/undefined logic
            setImageUrl(initialProduct.imageUrl || initialProduct.image_url || '');
            setImage2Url(initialProduct.image_2_url || '');
            setImage3Url(initialProduct.image_3_url || '');

            console.log('🔍 Edit Product - initialProduct:', initialProduct);
            setSelectedSubcategoryId(initialProduct.subcategory_id || initialProduct.subcategoryId || null);
            setIsActive(initialProduct.is_Active ?? initialProduct.isActive ?? true);

            setVariants(initialProduct.variants || []);

            if (!initialProduct.hasVariant && initialProduct.variants?.length > 0) {
                const firstVariant = initialProduct.variants[0];
                setSalePrice(firstVariant.salePrice?.toString() || firstVariant.saleprice?.toString() || '');
                setRegularPrice(firstVariant.regularPrice?.toString() || firstVariant.regularprice?.toString() || '');
                setWeight(firstVariant.weight?.toString() || '');
            }
        } else {
            setName('');
            setDescription('');
            setSku('');
            setHasVariants(false);
            setSalePrice('');
            setRegularPrice('');
            setWeight('');

            setImageUrl('');
            setImageFile(null);
            setImage2Url('');
            setImage2File(null);
            setImage3Url('');
            setImage3File(null);

            setSelectedSubcategoryId(null);
            setIsActive(true);
            setVariants([]);
        }
        setError(null);
    }, [initialProduct]);

    // Fetch categories with subcategories
    useEffect(() => {
        async function fetchCategories() {
            try {
                const response = await fetch('/api/categories-with-subcategories');

                if (response.ok) {
                    const data = await response.json();
                    console.log('📦 Categories fetched:', data);
                    if (Array.isArray(data)) {
                        setCategories(data);
                    } else {
                        console.warn('Categories data is not an array:', data);
                        setCategories([]);
                    }
                } else {
                    console.error('Failed to fetch categories:', response.status);
                    setCategories([]);
                }
            } catch (error) {
                console.error('Failed to fetch categories:', error);
                setCategories([]);
            }
        }
        if (open) {
            fetchCategories();
        }
    }, [open]);

    // Auto-detect category
    useEffect(() => {
        if (selectedSubcategoryId && !selectedCategoryId && categories.length > 0) {
            for (const cat of categories) {
                const subs = cat.subcategories || [];
                if (subs.some((s: any) => s.subcategory_id === selectedSubcategoryId)) {
                    setSelectedCategoryId(cat.category_id);
                    break;
                }
            }
        }
    }, [selectedSubcategoryId, selectedCategoryId, categories]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2 | 3) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                const preview = reader.result as string;
                if (slot === 1) {
                    setImageFile(file);
                    setImageUrl(preview);
                } else if (slot === 2) {
                    setImage2File(file);
                    setImage2Url(preview);
                } else if (slot === 3) {
                    setImage3File(file);
                    setImage3Url(preview);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = (slot: 1 | 2 | 3) => {
        if (slot === 1) {
            setImageFile(null);
            setImageUrl('');
        } else if (slot === 2) {
            setImage2File(null);
            setImage2Url('');
        } else if (slot === 3) {
            setImage3File(null);
            setImage3Url('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Upload images if selected
            let finalImageUrl = imageUrl;
            let finalImage2Url = image2Url;
            let finalImage3Url = image3Url;

            // Helper to upload only if it's a file (not existing URL)
            const uploadIfNeeded = async (file: File | null, currentUrl: string, prefix: string) => {
                if (file) {
                    console.log(`📤 Uploading image ${prefix}...`);
                    const result = await productsApiService.uploadImage(file, `${sku || 'product'}_${prefix}`);
                    if (result.error) throw new Error(`Image ${prefix} upload failed: ${result.error}`);
                    return result.url || '';
                }
                // If it's a blob url (preview) but no file, something is wrong, but usually we have file if we have blob
                // If it starts with http, it's existing url
                return currentUrl;
            };

            const [url1, url2, url3] = await Promise.all([
                uploadIfNeeded(imageFile, imageUrl, 'main'),
                uploadIfNeeded(image2File, image2Url, 'img2'),
                uploadIfNeeded(image3File, image3Url, 'img3')
            ]);

            finalImageUrl = url1;
            finalImage2Url = url2;
            finalImage3Url = url3;

            const productData: any = {
                name: name.trim(),
                description: description.trim(),
                sku: sku.trim(),
                has_variant: hasVariants,
                subcategory_id: selectedSubcategoryId,
                image_url: finalImageUrl,
                image_2_url: finalImage2Url, // New Field
                image_3_url: finalImage3Url, // New Field
                is_Active: isActive,
            };

            if (initialProduct?.id || initialProduct?.product_id) {
                productData.product_id = initialProduct.id || initialProduct.product_id;
            }

            const variantData: any = {
                variant_name: name.trim(),
                sku: sku.trim(),
                saleprice: parseFloat(salePrice) || 0,
                regularprice: parseFloat(regularPrice) || 0,
                stock: 0,
                weight: parseFloat(weight) || 0,
                color: '',
                is_Active: true,
                image_url: finalImageUrl,
                // Note: Variants typically share the product's main image or have their own
                // For now, keeping legacy behavior of sharing main image for single variants
            };

            if (initialProduct?.variants?.[0]?.variant_id) {
                variantData.variant_id = initialProduct.variants[0].variant_id;
            }

            productData.variants = hasVariants ? [] : [variantData];

            console.log('📤 Submitting product:', productData);

            const productId = initialProduct?.id || initialProduct?.product_id;
            const result = initialProduct
                ? await productsApiService.updateProduct(productId, productData)
                : await productsApiService.addProduct(productData);

            if (!result.success) {
                throw new Error(result.error || 'Failed to save product');
            }

            console.log('✅ Product saved successfully');
            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            console.error('❌ Error saving product:', error);
            setError(error.message || 'Failed to save product');
        } finally {
            setLoading(false);
        }
    };

    const ImageSlot = ({ slot, url, label }: { slot: 1 | 2 | 3, url: string, label: string }) => (
        <div className="flex flex-col items-center">
            <Label className="mb-2 text-xs font-medium text-gray-500">{label}</Label>
            <div className="relative group">
                <label htmlFor={`image-upload-${slot}`} className="cursor-pointer">
                    {url ? (
                        <div className="relative">
                            <img
                                src={url}
                                alt={`Product ${slot}`}
                                className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
                        </div>
                    ) : (
                        <div className="w-24 h-24 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:bg-gray-100 transition-colors">
                            <Upload className="h-6 w-6 text-gray-400 mb-1" />
                            <span className="text-[10px] text-gray-400">Add</span>
                        </div>
                    )}
                </label>
                {url && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            removeImage(slot);
                        }}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 shadow-sm hover:bg-red-200 transition-colors"
                    >
                        <X className="h-3 w-3" />
                    </button>
                )}
            </div>
            <input
                id={`image-upload-${slot}`}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImageChange(e, slot)}
            />
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {initialProduct ? 'Edit Product' : 'Add Product'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Image Section */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Product Images</Label>
                        <div className="flex flex-wrap gap-6 justify-center bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                            <ImageSlot slot={1} url={imageUrl} label="Main Image *" />
                            <ImageSlot slot={2} url={image2Url} label="Image 2" />
                            <ImageSlot slot={3} url={image3Url} label="Image 3" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name */}
                        <div className="col-span-2">
                            <Label htmlFor="name">Product Name *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                placeholder="Enter product name"
                                className="mt-1"
                            />
                        </div>

                        {/* Description */}
                        <div className="col-span-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Enter product description"
                                rows={3}
                                className="mt-1"
                            />
                        </div>

                        {/* SKU */}
                        <div>
                            <Label htmlFor="sku">SKU *</Label>
                            <Input
                                id="sku"
                                value={sku}
                                onChange={(e) => setSku(e.target.value)}
                                required
                                placeholder="Enter SKU"
                                readOnly={!!initialProduct}
                                className="mt-1"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <Label htmlFor="category">Category</Label>
                            <select
                                id="category"
                                className="w-full px-3 py-2 border rounded-md mt-1 bg-white text-sm"
                                value={selectedCategoryId || ''}
                                onChange={(e) => {
                                    const catId = e.target.value ? parseInt(e.target.value) : null;
                                    setSelectedCategoryId(catId);
                                    setSelectedSubcategoryId(null);
                                }}
                            >
                                <option value="">Select Category</option>
                                {categories.map((cat: any) => (
                                    <option key={cat.category_id} value={cat.category_id}>
                                        {cat.category_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Subcategory */}
                        <div>
                            <Label htmlFor="subcategory">Subcategory *</Label>
                            <select
                                id="subcategory"
                                className="w-full px-3 py-2 border rounded-md mt-1 bg-white text-sm"
                                value={selectedSubcategoryId || ''}
                                onChange={(e) => {
                                    const subId = e.target.value ? parseInt(e.target.value) : null;
                                    setSelectedSubcategoryId(subId);
                                }}
                                required
                            >
                                <option value="">Select Subcategory</option>
                                {selectedCategoryId && categories
                                    .find((c: any) => c.category_id === selectedCategoryId)
                                    ?.subcategories?.map((sub: any) => (
                                        <option key={sub.subcategory_id} value={sub.subcategory_id}>
                                            {sub.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>

                    {/* Has Variants Toggle */}
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="has-variants"
                            checked={hasVariants}
                            onCheckedChange={(checked) => setHasVariants(checked as boolean)}
                        />
                        <Label htmlFor="has-variants" className="cursor-pointer font-medium">
                            Has Variants
                        </Label>
                    </div>

                    {/* Single Variant Fields */}
                    {!hasVariants && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-gray-50/50">
                            <div>
                                <Label htmlFor="sale-price">Sale Price</Label>
                                <Input
                                    id="sale-price"
                                    type="number"
                                    step="0.01"
                                    value={salePrice}
                                    onChange={(e) => setSalePrice(e.target.value)}
                                    placeholder="0.00"
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="regular-price">Regular Price</Label>
                                <Input
                                    id="regular-price"
                                    type="number"
                                    step="0.01"
                                    value={regularPrice}
                                    onChange={(e) => setRegularPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label htmlFor="weight">Weight (g)</Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    value={weight}
                                    onChange={(e) => setWeight(e.target.value)}
                                    placeholder="0"
                                    className="mt-1"
                                />
                            </div>

                            <div className="flex items-center justify-between p-2 border rounded-md bg-white col-span-2 md:col-span-1">
                                <Label htmlFor="is-active" className="cursor-pointer">{isActive ? 'Active' : 'Inactive'}</Label>
                                <button
                                    type="button"
                                    id="is-active"
                                    onClick={() => setIsActive(!isActive)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-600' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Variants Section */}
                    {hasVariants && (
                        <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Variants</h4>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setVariants([...variants, {
                                            variant_name: '',
                                            sku: '',
                                            saleprice: 0,
                                            regularprice: 0,
                                            weight: 0,
                                            color: '',
                                            is_Active: true
                                        }]);
                                    }}
                                >
                                    + Add Variant
                                </Button>
                            </div>

                            {variants && variants.length > 0 ? (
                                variants.map((variant: any, index: number) => (
                                    <div key={index} className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold text-sm">Variant {index + 1}</span>
                                            {variants.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setVariants(variants.filter((_: any, i: number) => i !== index));
                                                    }}
                                                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                            {/* Variant fields implementation remains same, just styling updates if needed */}
                                            <div>
                                                <Label className="text-xs text-gray-500">Name *</Label>
                                                <Input
                                                    value={variant.variant_name || variant.name || ''}
                                                    onChange={(e) => {
                                                        const newVariants = [...variants];
                                                        newVariants[index] = { ...newVariants[index], variant_name: e.target.value };
                                                        setVariants(newVariants);
                                                    }}
                                                    placeholder="Gold - Small"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">SKU *</Label>
                                                <Input
                                                    value={variant.sku || ''}
                                                    onChange={(e) => {
                                                        const newVariants = [...variants];
                                                        newVariants[index] = { ...newVariants[index], sku: e.target.value };
                                                        setVariants(newVariants);
                                                    }}
                                                    placeholder="SKU"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Sale Price</Label>
                                                <Input
                                                    type="number"
                                                    value={variant.saleprice || variant.salePrice || 0}
                                                    onChange={(e) => {
                                                        const newVariants = [...variants];
                                                        newVariants[index] = { ...newVariants[index], saleprice: parseFloat(e.target.value) };
                                                        setVariants(newVariants);
                                                    }}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Regular Price</Label>
                                                <Input
                                                    type="number"
                                                    value={variant.regularprice || variant.regularPrice || 0}
                                                    onChange={(e) => {
                                                        const newVariants = [...variants];
                                                        newVariants[index] = { ...newVariants[index], regularprice: parseFloat(e.target.value) };
                                                        setVariants(newVariants);
                                                    }}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Weight (g)</Label>
                                                <Input
                                                    type="number"
                                                    value={variant.weight || 0}
                                                    onChange={(e) => {
                                                        const newVariants = [...variants];
                                                        newVariants[index] = { ...newVariants[index], weight: parseFloat(e.target.value) };
                                                        setVariants(newVariants);
                                                    }}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <Label className="text-xs text-gray-500">Color</Label>
                                                <Input
                                                    value={variant.color || ''}
                                                    onChange={(e) => {
                                                        const newVariants = [...variants];
                                                        newVariants[index] = { ...newVariants[index], color: e.target.value };
                                                        setVariants(newVariants);
                                                    }}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 bg-gray-50 border border-dashed rounded-lg">
                                    <p className="text-sm text-gray-500 mb-2">No variants created yet</p>
                                    <Button size="sm" variant="secondary" onClick={() => {
                                        setVariants([...variants, {
                                            variant_name: '',
                                            sku: '',
                                            saleprice: 0,
                                            regularprice: 0,
                                            weight: 0,
                                            color: '',
                                            is_Active: true
                                        }]);
                                    }}>Create First Variant</Button>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving Product...' : 'Save Product'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
