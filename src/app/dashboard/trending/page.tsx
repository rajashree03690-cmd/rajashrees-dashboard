'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Flame, Search, Plus, X, ArrowUpDown, Package, AlertCircle, Check, Loader2 } from 'lucide-react';

interface ProductVariant {
    variant_id: number;
    product_id: string;
    variant_name: string;
    sku: string;
    saleprice: number;
    regularprice: number;
    stock: number;
    image_url: string;
    is_Active: boolean;
    is_trending: boolean;
    product_name?: string;
}

const MAX_TRENDING = 50;

export default function TrendingPage() {
    const [trendingItems, setTrendingItems] = useState<ProductVariant[]>([]);
    const [allProducts, setAllProducts] = useState<ProductVariant[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [searchResults, setSearchResults] = useState<ProductVariant[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Fetch trending products
    const fetchTrending = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('product_variants')
                .select(`
                    variant_id,
                    product_id,
                    variant_name,
                    sku,
                    saleprice,
                    regularprice,
                    stock,
                    image_url,
                    is_Active,
                    is_trending,
                    master_product (name)
                `)
                .eq('is_trending', true)
                .eq('is_Active', true)
                .order('variant_id', { ascending: true });

            if (error) throw error;

            const mapped = (data || []).map((v: any) => ({
                ...v,
                product_name: v.master_product?.name || 'Unknown Product'
            }));
            setTrendingItems(mapped);
        } catch (err) {
            console.error('Error fetching trending:', err);
            showToast('Failed to load trending products', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrending();
    }, [fetchTrending]);

    // Search for products to add
    const searchProducts = useCallback(async (query: string) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        try {
            const { data, error } = await supabase
                .from('product_variants')
                .select(`
                    variant_id,
                    product_id,
                    variant_name,
                    sku,
                    saleprice,
                    regularprice,
                    stock,
                    image_url,
                    is_Active,
                    is_trending,
                    master_product (name)
                `)
                .eq('is_Active', true)
                .eq('is_trending', false)
                .ilike('sku', `%${query}%`)
                .limit(20);

            if (error) throw error;

            // Also search by product name
            const { data: nameData } = await supabase
                .from('product_variants')
                .select(`
                    variant_id,
                    product_id,
                    variant_name,
                    sku,
                    saleprice,
                    regularprice,
                    stock,
                    image_url,
                    is_Active,
                    is_trending,
                    master_product!inner (name)
                `)
                .eq('is_Active', true)
                .eq('is_trending', false)
                .ilike('master_product.name', `%${query}%`)
                .limit(20);

            // Combine and deduplicate
            const allResults = [...(data || []), ...(nameData || [])];
            const uniqueMap = new Map();
            allResults.forEach((v: any) => {
                if (!uniqueMap.has(v.variant_id)) {
                    uniqueMap.set(v.variant_id, {
                        ...v,
                        product_name: v.master_product?.name || 'Unknown'
                    });
                }
            });

            setSearchResults(Array.from(uniqueMap.values()));
        } catch (err) {
            console.error('Search error:', err);
        }
    }, []);

    // Debounced search
    useEffect(() => {
        const timeout = setTimeout(() => searchProducts(searchQuery), 300);
        return () => clearTimeout(timeout);
    }, [searchQuery, searchProducts]);

    // Toggle trending status
    const toggleTrending = async (variantId: number, makeTrending: boolean) => {
        if (makeTrending && trendingItems.length >= MAX_TRENDING) {
            showToast(`Maximum ${MAX_TRENDING} trending products allowed`, 'error');
            return;
        }

        setSaving(variantId);
        try {
            const { error } = await supabase
                .from('product_variants')
                .update({ is_trending: makeTrending })
                .eq('variant_id', variantId);

            if (error) throw error;

            showToast(
                makeTrending ? 'Added to trending' : 'Removed from trending',
                'success'
            );

            // Refresh data
            await fetchTrending();
            if (searchQuery) searchProducts(searchQuery);
        } catch (err) {
            console.error('Error updating trending:', err);
            showToast('Failed to update', 'error');
        } finally {
            setSaving(null);
        }
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const formatPrice = (price: number) => `₹${(price || 0).toLocaleString('en-IN')}`;

    return (
        <div className="p-6 space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
                    }`}>
                    {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-lg">
                            <Flame className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Trending Products</h1>
                            <p className="text-slate-500 text-sm">Curate up to {MAX_TRENDING} fast-moving products for the homepage</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${trendingItems.length >= MAX_TRENDING
                            ? 'bg-red-100 text-red-700'
                            : trendingItems.length >= MAX_TRENDING * 0.8
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                        }`}>
                        {trendingItems.length} / {MAX_TRENDING}
                    </span>
                    <button
                        onClick={() => setShowAddPanel(!showAddPanel)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        {showAddPanel ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showAddPanel ? 'Close' : 'Add Products'}
                    </button>
                </div>
            </div>

            {/* Add Products Panel */}
            {showAddPanel && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-3">Search & Add Products</h3>
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search by product name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            autoFocus
                        />
                    </div>

                    {searchResults.length > 0 ? (
                        <div className="max-h-80 overflow-y-auto space-y-2">
                            {searchResults.map((product) => (
                                <div key={product.variant_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-white border overflow-hidden flex-shrink-0">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-slate-300" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">{product.product_name}</p>
                                            <p className="text-xs text-slate-500">{product.sku} • {formatPrice(product.saleprice)} • Stock: {product.stock || 0}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleTrending(product.variant_id, true)}
                                        disabled={saving === product.variant_id || trendingItems.length >= MAX_TRENDING}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {saving === product.variant_id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Plus className="w-3 h-3" />
                                        )}
                                        Add
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : searchQuery.length >= 2 ? (
                        <p className="text-sm text-slate-500 text-center py-6">No products found matching &quot;{searchQuery}&quot;</p>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-6">Type at least 2 characters to search</p>
                    )}
                </div>
            )}

            {/* Trending Products Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-red-50">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Flame className="w-4 h-4 text-orange-500" />
                        Current Trending Products
                    </h3>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                        <span className="ml-2 text-slate-500">Loading...</span>
                    </div>
                ) : trendingItems.length === 0 ? (
                    <div className="text-center py-16">
                        <Flame className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-700">No trending products yet</h3>
                        <p className="text-slate-500 text-sm mt-1">Click &quot;Add Products&quot; to curate your trending collection</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-100 text-left">
                                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Product</th>
                                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">SKU</th>
                                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Price</th>
                                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Stock</th>
                                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {trendingItems.map((item, index) => (
                                    <tr key={item.variant_id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-5 py-3 text-sm text-slate-400 font-medium">{index + 1}</td>
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-slate-100 border overflow-hidden flex-shrink-0">
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package className="w-4 h-4 text-slate-300" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-800 line-clamp-1">{item.product_name}</p>
                                                    {item.variant_name && (
                                                        <p className="text-xs text-slate-400">{item.variant_name}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3 text-sm text-slate-600 font-mono">{item.sku}</td>
                                        <td className="px-5 py-3">
                                            <div>
                                                <span className="text-sm font-bold text-slate-800">{formatPrice(item.saleprice)}</span>
                                                {item.regularprice > item.saleprice && (
                                                    <span className="text-xs text-slate-400 line-through ml-1">{formatPrice(item.regularprice)}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${(item.stock || 0) === 0
                                                    ? 'bg-red-100 text-red-700'
                                                    : (item.stock || 0) < 10
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-green-100 text-green-700'
                                                }`}>
                                                {item.stock || 0}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <button
                                                onClick={() => toggleTrending(item.variant_id, false)}
                                                disabled={saving === item.variant_id}
                                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                            >
                                                {saving === item.variant_id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <X className="w-3 h-3" />
                                                )}
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
