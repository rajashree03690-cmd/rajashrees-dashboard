'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Plus, Edit, RefreshCw, FolderTree, ChevronRight,
    CheckCircle, XCircle, Search, Upload, X, Image as ImageIcon
} from 'lucide-react';
import { uploadCategoryImage } from '@/modules/marketing/services/banners.service';
import { toast } from 'sonner';

interface Category {
    id: number;
    name: string;
    is_active?: boolean;
    image_url?: string;
}

interface Subcategory {
    subcategory_id: number;
    name: string;
    category_id: number;
    is_active?: boolean;
    categories?: { id: number; name: string };
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Dialog states
    const [catDialog, setCatDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; category?: Category }>({
        open: false, mode: 'add'
    });
    const [subDialog, setSubDialog] = useState<{ open: boolean; mode: 'add' | 'edit'; subcategory?: Subcategory }>({
        open: false, mode: 'add'
    });
    const [catName, setCatName] = useState('');
    const [subName, setSubName] = useState('');
    const [subCategoryId, setSubCategoryId] = useState<number | ''>('');
    const [saving, setSaving] = useState(false);

    // Category image state
    const [catImageFile, setCatImageFile] = useState<File | null>(null);
    const [catImagePreview, setCatImagePreview] = useState('');
    const [catImageUrl, setCatImageUrl] = useState('');
    const catFileInputRef = useRef<HTMLInputElement>(null);

    // Fetch categories
    const fetchCategories = useCallback(async () => {
        try {
            const res = await fetch('/api/categories');
            const data = await res.json();
            if (Array.isArray(data)) setCategories(data);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    }, []);

    // Fetch subcategories (optionally by category)
    const fetchSubcategories = useCallback(async (categoryId?: number) => {
        try {
            const url = categoryId
                ? `/api/subcategories?category_id=${categoryId}`
                : '/api/subcategories';
            const res = await fetch(url);
            const data = await res.json();
            if (Array.isArray(data)) setSubcategories(data);
        } catch (err) {
            console.error('Error fetching subcategories:', err);
        }
    }, []);

    // Initial load
    useEffect(() => {
        async function load() {
            setLoading(true);
            await Promise.all([fetchCategories(), fetchSubcategories()]);
            setLoading(false);
        }
        load();
    }, [fetchCategories, fetchSubcategories]);

    // When a category is selected, filter subcategories
    useEffect(() => {
        if (selectedCategory) {
            fetchSubcategories(selectedCategory.id);
        } else {
            fetchSubcategories();
        }
    }, [selectedCategory, fetchSubcategories]);

    // Filter categories by search
    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- Category CRUD ---
    const openAddCategory = () => {
        setCatName('');
        setCatImageFile(null);
        setCatImagePreview('');
        setCatImageUrl('');
        setCatDialog({ open: true, mode: 'add' });
    };

    const openEditCategory = (cat: Category) => {
        setCatName(cat.name);
        setCatImageFile(null);
        setCatImagePreview(cat.image_url || '');
        setCatImageUrl(cat.image_url || '');
        setCatDialog({ open: true, mode: 'edit', category: cat });
    };

    const handleCatImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }

        setCatImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCatImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const saveCategory = async () => {
        if (!catName.trim()) return;
        setSaving(true);
        try {
            let finalImageUrl = catImageUrl;

            // Upload new image if selected
            if (catImageFile) {
                const result = await uploadCategoryImage(catImageFile, catName);
                if (result.error) {
                    toast.error(`Image upload failed: ${result.error}`);
                    setSaving(false);
                    return;
                }
                finalImageUrl = result.url || '';
            }

            if (catDialog.mode === 'add') {
                await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: catName, image_url: finalImageUrl || undefined }),
                });
            } else {
                await fetch('/api/categories', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: catDialog.category!.id,
                        name: catName,
                        image_url: finalImageUrl || undefined,
                    }),
                });
            }
            toast.success(catDialog.mode === 'add' ? 'Category added!' : 'Category updated!');
            await fetchCategories();
            setCatDialog({ open: false, mode: 'add' });
        } catch (err) {
            console.error('Error saving category:', err);
            toast.error('Failed to save category');
        } finally {
            setSaving(false);
        }
    };

    const toggleCategoryActive = async (cat: Category) => {
        const newStatus = !(cat.is_active ?? true);
        try {
            await fetch('/api/categories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cat.id, is_active: newStatus }),
            });
            setCategories(prev =>
                prev.map(c => c.id === cat.id ? { ...c, is_active: newStatus } : c)
            );
        } catch (err) {
            console.error('Error toggling category:', err);
        }
    };

    // --- Subcategory CRUD ---
    const openAddSubcategory = () => {
        setSubName('');
        setSubCategoryId(selectedCategory?.id || '');
        setSubDialog({ open: true, mode: 'add' });
    };

    const openEditSubcategory = (sub: Subcategory) => {
        setSubName(sub.name);
        setSubCategoryId(sub.category_id);
        setSubDialog({ open: true, mode: 'edit', subcategory: sub });
    };

    const saveSubcategory = async () => {
        if (!subName.trim() || !subCategoryId) return;
        setSaving(true);
        try {
            if (subDialog.mode === 'add') {
                await fetch('/api/subcategories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: subName, category_id: subCategoryId }),
                });
            } else {
                await fetch('/api/subcategories', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        subcategory_id: subDialog.subcategory!.subcategory_id,
                        name: subName,
                        category_id: subCategoryId,
                    }),
                });
            }
            toast.success(subDialog.mode === 'add' ? 'Subcategory added!' : 'Subcategory updated!');
            await fetchSubcategories(selectedCategory?.id);
            setSubDialog({ open: false, mode: 'add' });
        } catch (err) {
            console.error('Error saving subcategory:', err);
            toast.error('Failed to save subcategory');
        } finally {
            setSaving(false);
        }
    };

    const toggleSubcategoryActive = async (sub: Subcategory) => {
        const newStatus = !(sub.is_active ?? true);
        try {
            await fetch('/api/subcategories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subcategory_id: sub.subcategory_id, is_active: newStatus }),
            });
            setSubcategories(prev =>
                prev.map(s => s.subcategory_id === sub.subcategory_id
                    ? { ...s, is_active: newStatus }
                    : s)
            );
        } catch (err) {
            console.error('Error toggling subcategory:', err);
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                        Categories & Subcategories
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Manage product categories and their subcategories
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={openAddCategory}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90 rounded-full gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Category
                    </Button>
                    <Button
                        onClick={openAddSubcategory}
                        variant="outline"
                        className="rounded-full gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Add Subcategory
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Categories</p>
                                <p className="text-2xl font-bold">{categories.length}</p>
                            </div>
                            <FolderTree className="h-8 w-8 text-purple-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Subcategories</p>
                                <p className="text-2xl font-bold">{subcategories.length}</p>
                            </div>
                            <ChevronRight className="h-8 w-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Active Categories</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {categories.filter(c => c.is_active !== false).length}
                                </p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="text-sm font-medium mb-2 block">Search Categories</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search by category name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedCategory(null);
                            }}
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Clear
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Main Content: Categories table + Subcategories table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Categories Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FolderTree className="h-5 w-5" />
                            Categories ({filteredCategories.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
                            </div>
                        ) : filteredCategories.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                No categories found
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredCategories.map((cat) => {
                                    const isActive = cat.is_active !== false;
                                    const isSelected = selectedCategory?.id === cat.id;
                                    return (
                                        <div
                                            key={cat.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${isSelected
                                                ? 'bg-purple-50 border-purple-300 shadow-sm'
                                                : 'hover:bg-gray-50 border-gray-200'
                                                } ${!isActive ? 'opacity-60' : ''}`}
                                            onClick={() => setSelectedCategory(isSelected ? null : cat)}
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Category Image Thumbnail */}
                                                {cat.image_url ? (
                                                    <img
                                                        src={cat.image_url}
                                                        alt={cat.name}
                                                        className="h-8 w-8 rounded-lg object-cover border"
                                                    />
                                                ) : (
                                                    <FolderTree className={`h-4 w-4 ${isSelected ? 'text-purple-600' : 'text-gray-400'}`} />
                                                )}
                                                <span className="font-medium">{cat.name}</span>
                                                {!isActive && (
                                                    <Badge variant="secondary" className="text-xs">Disabled</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                {/* Active Toggle */}
                                                <button
                                                    onClick={() => toggleCategoryActive(cat)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-green-600' : 'bg-gray-300'}`}
                                                    title={isActive ? 'Click to disable' : 'Click to enable'}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                                                </button>
                                                {/* Edit */}
                                                <button
                                                    onClick={() => openEditCategory(cat)}
                                                    className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                                                    title="Edit Category"
                                                >
                                                    <Edit className="h-3.5 w-3.5 text-blue-600" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Subcategories Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ChevronRight className="h-5 w-5" />
                            Subcategories
                            {selectedCategory && (
                                <Badge variant="outline" className="ml-2">
                                    of {selectedCategory.name}
                                </Badge>
                            )}
                            <span className="text-sm font-normal text-gray-500">
                                ({subcategories.length})
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
                            </div>
                        ) : subcategories.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                {selectedCategory
                                    ? `No subcategories under "${selectedCategory.name}"`
                                    : 'No subcategories found'}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {subcategories.map((sub) => {
                                    const isActive = sub.is_active !== false;
                                    const parentName = sub.categories?.name || categories.find(c => c.id === sub.category_id)?.name || '-';
                                    return (
                                        <div
                                            key={sub.subcategory_id}
                                            className={`flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-all ${!isActive ? 'opacity-60' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <ChevronRight className="h-4 w-4 text-gray-400" />
                                                <div>
                                                    <span className="font-medium">{sub.name}</span>
                                                    {!selectedCategory && (
                                                        <p className="text-xs text-gray-500">{parentName}</p>
                                                    )}
                                                </div>
                                                {!isActive && (
                                                    <Badge variant="secondary" className="text-xs">Disabled</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Active Toggle */}
                                                <button
                                                    onClick={() => toggleSubcategoryActive(sub)}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-green-600' : 'bg-gray-300'}`}
                                                    title={isActive ? 'Click to disable' : 'Click to enable'}
                                                >
                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                                                </button>
                                                {/* Edit */}
                                                <button
                                                    onClick={() => openEditSubcategory(sub)}
                                                    className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                                                    title="Edit Subcategory"
                                                >
                                                    <Edit className="h-3.5 w-3.5 text-blue-600" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Add/Edit Category Dialog */}
            <Dialog open={catDialog.open} onOpenChange={(open) => setCatDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{catDialog.mode === 'add' ? 'Add New Category' : 'Edit Category'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Category Name</label>
                            <Input
                                value={catName}
                                onChange={(e) => setCatName(e.target.value)}
                                placeholder="Enter category name"
                                autoFocus
                            />
                        </div>

                        {/* Category Image Upload */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Category Image</label>
                            <p className="text-xs text-gray-500 mb-2">This image will appear on the storefront for this category</p>
                            <div>
                                {catImagePreview ? (
                                    <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-purple-200">
                                        <img
                                            src={catImagePreview}
                                            alt="Category preview"
                                            className="w-full h-36 object-cover"
                                        />
                                        <button
                                            onClick={() => {
                                                setCatImagePreview('');
                                                setCatImageFile(null);
                                                setCatImageUrl('');
                                            }}
                                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => catFileInputRef.current?.click()}
                                            className="absolute bottom-2 right-2 px-3 py-1 bg-white/90 text-xs rounded-lg hover:bg-white shadow"
                                        >
                                            Change
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => catFileInputRef.current?.click()}
                                        className="w-full h-36 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer"
                                    >
                                        <Upload className="h-8 w-8 text-gray-400" />
                                        <div className="text-center">
                                            <p className="text-xs font-medium text-gray-600">Click to upload</p>
                                            <p className="text-xs text-gray-400">800×600px recommended</p>
                                        </div>
                                    </button>
                                )}
                                <input
                                    ref={catFileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleCatImageSelect}
                                    className="hidden"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCatDialog({ open: false, mode: 'add' })}>
                            Cancel
                        </Button>
                        <Button onClick={saveCategory} disabled={saving || !catName.trim()}>
                            {saving ? (
                                <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                            ) : (
                                catDialog.mode === 'add' ? 'Add Category' : 'Save Changes'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add/Edit Subcategory Dialog */}
            <Dialog open={subDialog.open} onOpenChange={(open) => setSubDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{subDialog.mode === 'add' ? 'Add New Subcategory' : 'Edit Subcategory'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Parent Category</label>
                            <select
                                value={subCategoryId}
                                onChange={(e) => setSubCategoryId(parseInt(e.target.value) || '')}
                                className="w-full border rounded-md px-3 py-2 text-sm"
                            >
                                <option value="">Select a category</option>
                                {categories.filter(c => c.is_active !== false).map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Subcategory Name</label>
                            <Input
                                value={subName}
                                onChange={(e) => setSubName(e.target.value)}
                                placeholder="Enter subcategory name"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubDialog({ open: false, mode: 'add' })}>
                            Cancel
                        </Button>
                        <Button onClick={saveSubcategory} disabled={saving || !subName.trim() || !subCategoryId}>
                            {saving ? (
                                <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Saving...</>
                            ) : (
                                subDialog.mode === 'add' ? 'Add Subcategory' : 'Save Changes'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
