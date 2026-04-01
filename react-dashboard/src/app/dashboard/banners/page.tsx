'use client';

import { useState, useRef, useMemo } from 'react';
import { useBanners, useAddBanner, useUpdateBanner, useDeleteBanner, useToggleBannerStatus } from '@/lib/hooks/use-banners';
import type { Banner } from '@/lib/hooks/use-banners';
import { uploadBannerImage } from '@/modules/marketing/services/banners.service';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    Search, Image as ImageIcon, Plus, Edit, Trash2, Eye, Upload,
    Calendar, Link2, X, CheckCircle, XCircle, ExternalLink,
    LayoutTemplate, Megaphone, Grid3X3, PanelLeft, Monitor,
    ArrowUpDown, Sparkles, ChevronRight, Filter, MoreVertical,
    Copy, Power, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Banner Type Configuration ──────────────────────
const BANNER_TYPES = [
    {
        id: 'all',
        label: 'All Banners',
        icon: Grid3X3,
        color: 'from-gray-500 to-gray-600',
        bgLight: 'bg-gray-50',
    },
    {
        id: 'hero',
        label: 'Hero Banners',
        icon: LayoutTemplate,
        color: 'from-indigo-500 to-purple-600',
        bgLight: 'bg-indigo-50',
        description: 'Full-width carousel banners on homepage',
        dimensions: '1920 × 600px',
    },
    {
        id: 'promotional',
        label: 'Promotional',
        icon: Megaphone,
        color: 'from-orange-500 to-red-500',
        bgLight: 'bg-orange-50',
        description: 'Sales, offers & seasonal campaigns',
        dimensions: '1200 × 400px',
    },
    {
        id: 'collection',
        label: 'Collection',
        icon: Grid3X3,
        color: 'from-emerald-500 to-teal-500',
        bgLight: 'bg-emerald-50',
        description: 'Highlight specific product collections',
        dimensions: '800 × 400px',
    },
    {
        id: 'sidebar',
        label: 'Sidebar',
        icon: PanelLeft,
        color: 'from-sky-500 to-blue-600',
        bgLight: 'bg-sky-50',
        description: 'Vertical banners for shop sidebar',
        dimensions: '300 × 600px',
    },
];

const PLACEMENT_OPTIONS = [
    { value: 'homepage_top', label: 'Homepage — Top Carousel', icon: '🏠' },
    { value: 'homepage_middle', label: 'Homepage — Between Sections', icon: '📐' },
    { value: 'shop_top', label: 'Shop — Top Banner', icon: '🛍️' },
    { value: 'shop_sidebar', label: 'Shop — Sidebar', icon: '📏' },
    { value: 'category_header', label: 'Category Page — Header', icon: '📂' },
    { value: 'above_footer', label: 'Above Footer — All Pages', icon: '⬇️' },
];

const TARGET_PAGES = [
    { value: 'homepage', label: 'Homepage' },
    { value: 'shop', label: 'Shop' },
    { value: 'category', label: 'Category' },
    { value: 'product', label: 'Product' },
    { value: 'cart', label: 'Cart' },
];

export default function BannersPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const { data: banners = [], isLoading } = useBanners();
    const addBannerMutation = useAddBanner();
    const updateBannerMutation = useUpdateBanner();
    const deleteBannerMutation = useDeleteBanner();
    const toggleStatusMutation = useToggleBannerStatus();

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [previewBanner, setPreviewBanner] = useState<Banner | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [redirectUrl, setRedirectUrl] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [imageUrl, setImageUrl] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [saving, setSaving] = useState(false);
    const [bannerType, setBannerType] = useState('hero');
    const [placement, setPlacement] = useState('homepage_top');
    const [ctaText, setCtaText] = useState('Shop Now');
    const [displayOrder, setDisplayOrder] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filtered banners
    const filteredBanners = useMemo(() => {
        let filtered = banners;
        if (activeTab !== 'all') {
            filtered = filtered.filter(b => (b.banner_type || 'hero') === activeTab);
        }
        if (searchTerm) {
            filtered = filtered.filter(b =>
                b.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                b.subtitle?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return filtered;
    }, [banners, activeTab, searchTerm]);

    // Stats
    const totalBanners = banners.length;
    const activeBanners = banners.filter(b => b.is_active).length;
    const typeCount = (type: string) => banners.filter(b => (b.banner_type || 'hero') === type).length;

    // Open Add Dialog
    const openAddDialog = (type?: string) => {
        setEditingBanner(null);
        setTitle('');
        setSubtitle('');
        setRedirectUrl('');
        setStartDate('');
        setEndDate('');
        setIsActive(true);
        setImageUrl('');
        setImageFile(null);
        setImagePreview('');
        setBannerType(type && type !== 'all' ? type : 'hero');
        setPlacement('homepage_top');
        setCtaText('Shop Now');
        setDisplayOrder(0);
        setDialogOpen(true);
    };

    // Open Edit Dialog
    const openEditDialog = (banner: Banner) => {
        setEditingBanner(banner);
        setTitle(banner.title || '');
        setSubtitle(banner.subtitle || '');
        setRedirectUrl(banner.redirect_url || '');
        setStartDate(banner.start_date || '');
        setEndDate(banner.end_date || '');
        setIsActive(banner.is_active);
        setImageUrl(banner.image_url || '');
        setImageFile(null);
        setImagePreview(banner.image_url || '');
        setBannerType(banner.banner_type || 'hero');
        setPlacement(banner.placement || 'homepage_top');
        setCtaText(banner.cta_text || 'Shop Now');
        setDisplayOrder(banner.display_order || 0);
        setDialogOpen(true);
    };

    // Duplicate banner
    const duplicateBanner = (banner: Banner) => {
        setEditingBanner(null);
        setTitle(`${banner.title} (Copy)`);
        setSubtitle(banner.subtitle || '');
        setRedirectUrl(banner.redirect_url || '');
        setStartDate('');
        setEndDate('');
        setIsActive(false);
        setImageUrl(banner.image_url || '');
        setImageFile(null);
        setImagePreview(banner.image_url || '');
        setBannerType(banner.banner_type || 'hero');
        setPlacement(banner.placement || 'homepage_top');
        setCtaText(banner.cta_text || 'Shop Now');
        setDisplayOrder(0);
        setDialogOpen(true);
    };

    // Handle image selection
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be less than 5MB');
            return;
        }
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setImagePreview(reader.result as string);
        reader.readAsDataURL(file);
    };

    // Handle Save
    const handleSave = async () => {
        if (!title.trim()) { toast.error('Title is required'); return; }
        if (!imagePreview && !imageUrl) { toast.error('Please upload a banner image'); return; }

        setSaving(true);
        try {
            let finalImageUrl = imageUrl;
            if (imageFile) {
                const result = await uploadBannerImage(imageFile);
                if (result.error) { toast.error(`Upload failed: ${result.error}`); setSaving(false); return; }
                finalImageUrl = result.url || '';
            }

            const bannerData: Partial<Banner> = {
                title: title.trim(),
                subtitle: subtitle.trim() || null,
                image_url: finalImageUrl,
                redirect_url: redirectUrl.trim() || null,
                start_date: startDate || null,
                end_date: endDate || null,
                is_active: isActive,
                banner_type: bannerType,
                placement: placement,
                cta_text: ctaText.trim() || null,
                display_order: displayOrder,
            };

            if (editingBanner) {
                await updateBannerMutation.mutateAsync({ bannerId: editingBanner.banner_id, updates: bannerData });
            } else {
                await addBannerMutation.mutateAsync(bannerData);
            }
            setDialogOpen(false);
        } catch (error) {
            console.error('Save error:', error);
        } finally {
            setSaving(false);
        }
    };

    // Handle Delete
    const handleDelete = async (bannerId: string) => {
        try {
            await deleteBannerMutation.mutateAsync(bannerId);
            setDeleteConfirmId(null);
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    // Get type config
    const getTypeConfig = (type: string) => BANNER_TYPES.find(t => t.id === type) || BANNER_TYPES[1];

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
                <div className="flex gap-3">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 w-32 bg-gray-100 rounded-xl animate-pulse" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ─── Header ─── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-200">
                            <ImageIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Create and manage banners for your storefront ({totalBanners} total)
                            </p>
                        </div>
                    </div>
                </div>
                <Button
                    onClick={() => openAddDialog(activeTab)}
                    className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90 rounded-xl px-5 shadow-lg shadow-indigo-200 hover:shadow-xl transition-all"
                >
                    <Plus className="h-4 w-4" />
                    Add Banner
                </Button>
            </div>

            {/* ─── Stats Row ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{totalBanners}</p>
                        </div>
                        <div className="p-2 bg-gray-100 rounded-xl">
                            <ImageIcon className="h-5 w-5 text-gray-500" />
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-green-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-green-600 uppercase tracking-wider">Active</p>
                            <p className="text-2xl font-bold text-green-700 mt-1">{activeBanners}</p>
                        </div>
                        <div className="p-2 bg-green-100 rounded-xl">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-red-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-red-500 uppercase tracking-wider">Inactive</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{totalBanners - activeBanners}</p>
                        </div>
                        <div className="p-2 bg-red-100 rounded-xl">
                            <XCircle className="h-5 w-5 text-red-500" />
                        </div>
                    </div>
                </div>
                <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-indigo-500 uppercase tracking-wider">Hero</p>
                            <p className="text-2xl font-bold text-indigo-700 mt-1">{typeCount('hero')}</p>
                        </div>
                        <div className="p-2 bg-indigo-100 rounded-xl">
                            <LayoutTemplate className="h-5 w-5 text-indigo-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Type Tabs ─── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-1.5 shadow-sm">
                <div className="flex gap-1 overflow-x-auto">
                    {BANNER_TYPES.map(type => {
                        const count = type.id === 'all' ? totalBanners : typeCount(type.id);
                        const Icon = type.icon;
                        return (
                            <button
                                key={type.id}
                                onClick={() => setActiveTab(type.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200
                                    ${activeTab === type.id
                                        ? `bg-gradient-to-r ${type.color} text-white shadow-md`
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {type.label}
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === type.id ? 'bg-white/20' : 'bg-gray-100'}`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ─── Search & Filters ─── */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search banners by title or subtitle..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white border-gray-200 rounded-xl h-10"
                    />
                </div>
            </div>

            {/* ─── Active Tab Description ─── */}
            {activeTab !== 'all' && (
                <div className={`${getTypeConfig(activeTab).bgLight} rounded-2xl p-4 flex items-center gap-4 border border-gray-100`}>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${getTypeConfig(activeTab).color} shadow-lg`}>
                        {(() => { const Icon = getTypeConfig(activeTab).icon; return <Icon className="h-6 w-6 text-white" />; })()}
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{getTypeConfig(activeTab).label}</h3>
                        <p className="text-sm text-gray-500">{'description' in getTypeConfig(activeTab) ? (getTypeConfig(activeTab) as any).description : ''}</p>
                    </div>
                    {'dimensions' in getTypeConfig(activeTab) && (
                        <div className="text-right">
                            <p className="text-xs text-gray-400 uppercase tracking-wider">Recommended</p>
                            <p className="text-sm font-semibold text-gray-700">{(getTypeConfig(activeTab) as any).dimensions}</p>
                        </div>
                    )}
                    <Button
                        onClick={() => openAddDialog(activeTab)}
                        size="sm"
                        className={`gap-1 bg-gradient-to-r ${getTypeConfig(activeTab).color} text-white rounded-lg`}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add {getTypeConfig(activeTab).label.replace(' Banners', '')}
                    </Button>
                </div>
            )}

            {/* ─── Banners Grid ─── */}
            {filteredBanners.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl mx-auto flex items-center justify-center mb-4">
                        <ImageIcon className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700">
                        {searchTerm ? 'No banners match your search' : `No ${activeTab === 'all' ? '' : activeTab + ' '}banners yet`}
                    </h3>
                    <p className="text-gray-400 mt-1 text-sm">
                        {searchTerm ? 'Try a different search term' : 'Click "Add Banner" to create your first one'}
                    </p>
                    {!searchTerm && (
                        <Button
                            onClick={() => openAddDialog(activeTab)}
                            className="mt-4 gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl"
                        >
                            <Plus className="h-4 w-4" />
                            Add Banner
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredBanners.map((banner) => {
                        const typeConfig = getTypeConfig(banner.banner_type || 'hero');
                        return (
                            <div
                                key={banner.banner_id}
                                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg hover:border-gray-200 transition-all duration-300 group"
                            >
                                {/* Image */}
                                <div className="relative aspect-[16/9] bg-gray-100 overflow-hidden">
                                    {banner.image_url ? (
                                        <img
                                            src={banner.image_url}
                                            alt={banner.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className={`flex items-center justify-center h-full bg-gradient-to-br ${typeConfig.color}`}>
                                            <ImageIcon className="h-12 w-12 text-white/50" />
                                        </div>
                                    )}

                                    {/* Hover overlay with actions */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                                            <button
                                                onClick={() => setPreviewBanner(banner)}
                                                className="p-2 bg-white/90 backdrop-blur rounded-lg hover:bg-white transition-colors shadow"
                                                title="Preview"
                                            >
                                                <Eye className="h-4 w-4 text-gray-700" />
                                            </button>
                                            <button
                                                onClick={() => openEditDialog(banner)}
                                                className="p-2 bg-white/90 backdrop-blur rounded-lg hover:bg-white transition-colors shadow"
                                                title="Edit"
                                            >
                                                <Edit className="h-4 w-4 text-blue-600" />
                                            </button>
                                            <button
                                                onClick={() => duplicateBanner(banner)}
                                                className="p-2 bg-white/90 backdrop-blur rounded-lg hover:bg-white transition-colors shadow"
                                                title="Duplicate"
                                            >
                                                <Copy className="h-4 w-4 text-gray-600" />
                                            </button>
                                            <div className="flex-1" />
                                            <button
                                                onClick={() => setDeleteConfirmId(banner.banner_id)}
                                                className="p-2 bg-red-500/90 backdrop-blur rounded-lg hover:bg-red-600 transition-colors shadow"
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4 text-white" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Top badges */}
                                    <div className="absolute top-3 left-3 flex items-center gap-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-gradient-to-r ${typeConfig.color} text-white shadow`}>
                                            {banner.banner_type || 'hero'}
                                        </span>
                                    </div>
                                    <div className="absolute top-3 right-3">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow ${banner.is_active
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-500 text-white'
                                            }`}>
                                            {banner.is_active ? '● Live' : '○ Draft'}
                                        </span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-gray-900 truncate">{banner.title}</h3>
                                            {banner.subtitle && (
                                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{banner.subtitle}</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => toggleStatusMutation.mutate({
                                                bannerId: banner.banner_id,
                                                isActive: !banner.is_active,
                                            })}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${banner.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                                            title={banner.is_active ? 'Deactivate' : 'Activate'}
                                        >
                                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${banner.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                                        </button>
                                    </div>

                                    {/* Meta info */}
                                    <div className="flex flex-wrap items-center gap-2 mt-3">
                                        {banner.placement && (
                                            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                                📍 {PLACEMENT_OPTIONS.find(p => p.value === banner.placement)?.label || banner.placement}
                                            </span>
                                        )}
                                        {banner.redirect_url && (
                                            <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                                <Link2 className="h-2.5 w-2.5" />
                                                {banner.redirect_url.length > 20 ? banner.redirect_url.slice(0, 20) + '...' : banner.redirect_url}
                                            </span>
                                        )}
                                        {banner.start_date && (
                                            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                                                <Calendar className="h-2.5 w-2.5" />
                                                Scheduled
                                            </span>
                                        )}
                                    </div>

                                    {/* Quick actions row */}
                                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                        <Button size="sm" variant="outline" onClick={() => openEditDialog(banner)} className="flex-1 h-8 text-xs gap-1 rounded-lg">
                                            <Edit className="h-3 w-3" /> Edit
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => duplicateBanner(banner)} className="h-8 text-xs gap-1 rounded-lg">
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            size="sm" variant="outline"
                                            onClick={() => setDeleteConfirmId(banner.banner_id)}
                                            className="h-8 text-xs gap-1 rounded-lg text-red-500 border-red-200 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ─── Add/Edit Banner Dialog ─── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
                    <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                {editingBanner ? (
                                    <><Edit className="h-5 w-5 text-blue-600" /> Edit Banner</>
                                ) : (
                                    <><Plus className="h-5 w-5 text-indigo-600" /> Add New Banner</>
                                )}
                            </DialogTitle>
                        </DialogHeader>
                    </div>

                    <div className="px-6 py-5 space-y-6">
                        {/* Banner Type Selector */}
                        <div>
                            <Label className="text-sm font-semibold text-gray-700 mb-3 block">Banner Type</Label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {BANNER_TYPES.filter(t => t.id !== 'all').map(type => {
                                    const Icon = type.icon;
                                    return (
                                        <button
                                            key={type.id}
                                            onClick={() => setBannerType(type.id)}
                                            className={`relative p-3 rounded-xl border-2 transition-all duration-200 text-left
                                                ${bannerType === type.id
                                                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${type.color} w-fit mb-2`}>
                                                <Icon className="h-4 w-4 text-white" />
                                            </div>
                                            <p className="text-xs font-semibold text-gray-900">{type.label.replace(' Banners', '')}</p>
                                            {'dimensions' in type && (
                                                <p className="text-[10px] text-gray-400 mt-0.5">{(type as any).dimensions}</p>
                                            )}
                                            {bannerType === type.id && (
                                                <div className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                                                    <CheckCircle className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Image Upload */}
                        <div>
                            <Label className="text-sm font-semibold text-gray-700">Banner Image *</Label>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Recommended: {(BANNER_TYPES.find(t => t.id === bannerType) as any)?.dimensions || '1920×600px'}, JPG/PNG/WebP, max 5MB
                            </p>
                            <div className="mt-2">
                                {imagePreview ? (
                                    <div className="relative rounded-xl overflow-hidden border-2 border-indigo-200 shadow-sm">
                                        <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover" />
                                        <button
                                            onClick={() => { setImagePreview(''); setImageFile(null); setImageUrl(''); }}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="absolute bottom-2 right-2 px-3 py-1.5 bg-white/95 text-xs font-medium rounded-lg hover:bg-white shadow"
                                        >
                                            Change Image
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-48 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                                    >
                                        <div className="p-3 bg-gray-100 rounded-xl group-hover:bg-indigo-100 transition-colors">
                                            <Upload className="h-8 w-8 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-gray-600">Click to upload</p>
                                            <p className="text-xs text-gray-400">JPG, PNG or WebP, max 5MB</p>
                                        </div>
                                    </button>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                            </div>
                        </div>

                        {/* Title & Subtitle */}
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <Label htmlFor="b-title" className="text-sm font-semibold text-gray-700">Title *</Label>
                                <Input id="b-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer Collection Sale" className="mt-1.5 rounded-lg" />
                            </div>
                            <div>
                                <Label htmlFor="b-subtitle" className="text-sm font-semibold text-gray-700">Subtitle</Label>
                                <Textarea id="b-subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Up to 50% off on selected items" rows={2} className="mt-1.5 rounded-lg" />
                            </div>
                        </div>

                        {/* Placement & CTA */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-sm font-semibold text-gray-700">Placement</Label>
                                <select
                                    value={placement}
                                    onChange={(e) => setPlacement(e.target.value)}
                                    className="mt-1.5 w-full h-10 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {PLACEMENT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label htmlFor="b-cta" className="text-sm font-semibold text-gray-700">CTA Button Text</Label>
                                <Input id="b-cta" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Shop Now" className="mt-1.5 rounded-lg" />
                            </div>
                        </div>

                        {/* Redirect URL */}
                        <div>
                            <Label htmlFor="b-url" className="text-sm font-semibold text-gray-700">Redirect URL</Label>
                            <div className="relative mt-1.5">
                                <ExternalLink className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <Input id="b-url" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="/shop?category=Neckwear" className="pl-10 rounded-lg" />
                            </div>
                        </div>

                        {/* Date Range & Order */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label htmlFor="b-start" className="text-sm font-semibold text-gray-700">Start Date</Label>
                                <Input id="b-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 rounded-lg" />
                            </div>
                            <div>
                                <Label htmlFor="b-end" className="text-sm font-semibold text-gray-700">End Date</Label>
                                <Input id="b-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 rounded-lg" />
                            </div>
                            <div>
                                <Label htmlFor="b-order" className="text-sm font-semibold text-gray-700">Display Order</Label>
                                <Input id="b-order" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} className="mt-1.5 rounded-lg" min={0} />
                            </div>
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                                <p className="font-semibold text-sm text-gray-800">Active Status</p>
                                <p className="text-xs text-gray-500">Banner will be visible on the website when active</p>
                            </div>
                            <button
                                onClick={() => setIsActive(!isActive)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* Live Preview */}
                        {imagePreview && (
                            <div>
                                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                                    <Monitor className="h-4 w-4" /> Live Preview
                                </Label>
                                <div className="mt-2 rounded-xl overflow-hidden shadow-lg border border-gray-100 relative" style={{ aspectRatio: '16/7' }}>
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/25 to-transparent flex items-center px-8">
                                        <div className="text-white space-y-2">
                                            <h3 className="text-2xl font-bold">{title || 'Banner Title'}</h3>
                                            {subtitle && <p className="text-sm text-gray-200 max-w-sm">{subtitle}</p>}
                                            <span className="inline-flex items-center gap-1 text-xs bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-1.5 rounded-full font-medium">
                                                {ctaText || 'Shop Now'} <ChevronRight className="h-3 w-3" />
                                            </span>
                                        </div>
                                    </div>
                                    <div className="absolute top-2 right-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-gradient-to-r ${getTypeConfig(bannerType).color} text-white shadow`}>
                                            {bannerType}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-end gap-3">
                        <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg px-6 shadow-lg hover:shadow-xl transition-all gap-2"
                        >
                            {saving ? (
                                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</>
                            ) : editingBanner ? (
                                <><CheckCircle className="h-4 w-4" /> Update Banner</>
                            ) : (
                                <><Plus className="h-4 w-4" /> Add Banner</>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Delete Confirmation ─── */}
            <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
                <DialogContent className="max-w-sm">
                    <div className="text-center py-4">
                        <div className="w-14 h-14 bg-red-100 rounded-2xl mx-auto flex items-center justify-center mb-4">
                            <Trash2 className="h-7 w-7 text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Delete Banner</h3>
                        <p className="text-sm text-gray-500 mt-2">This action cannot be undone. The banner will be permanently removed from the website.</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="flex-1 rounded-lg">Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                            className="flex-1 rounded-lg gap-1"
                        >
                            <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Full Preview Dialog ─── */}
            <Dialog open={!!previewBanner} onOpenChange={() => setPreviewBanner(null)}>
                <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-2xl">
                    {previewBanner && (
                        <div className="relative" style={{ aspectRatio: '16/7' }}>
                            <img
                                src={previewBanner.image_url}
                                alt={previewBanner.title}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent flex items-center px-12">
                                <div className="text-white space-y-4 max-w-lg">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-gradient-to-r ${getTypeConfig(previewBanner.banner_type || 'hero').color} text-white`}>
                                            {previewBanner.banner_type || 'hero'}
                                        </span>
                                        {previewBanner.placement && (
                                            <span className="text-[10px] font-medium bg-white/20 backdrop-blur px-2 py-1 rounded-md">
                                                📍 {PLACEMENT_OPTIONS.find(p => p.value === previewBanner.placement)?.label || previewBanner.placement}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-4xl font-bold leading-tight">{previewBanner.title}</h2>
                                    {previewBanner.subtitle && (
                                        <p className="text-lg text-gray-200">{previewBanner.subtitle}</p>
                                    )}
                                    {previewBanner.redirect_url && (
                                        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-2.5 rounded-full text-sm font-bold shadow-lg">
                                            {previewBanner.cta_text || 'Shop Now'} <ChevronRight className="h-4 w-4" />
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setPreviewBanner(null)}
                                className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
