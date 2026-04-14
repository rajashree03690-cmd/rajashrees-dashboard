'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Search, RefreshCw, Mail, Phone, User, MessageSquare,
    Eye, Trash2, Clock, CheckCircle, Inbox, Globe
} from 'lucide-react';
import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';

interface WebEnquiry {
    id: number;
    name: string;
    email: string | null;
    mobile: string;
    message: string;
    status: 'New' | 'Read' | 'Replied' | 'Closed';
    read: boolean;
    admin_notes: string | null;
    created_at: string;
    updated_at: string;
}

export default function EnquiriesPage() {
    const [enquiries, setEnquiries] = useState<WebEnquiry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEnquiry, setSelectedEnquiry] = useState<WebEnquiry | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [adminNotes, setAdminNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Pagination
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        loadEnquiries();
    }, []);

    const loadEnquiries = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/web_enquiries?select=*&order=created_at.desc`,
                {
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`
                    }
                }
            );
            if (res.ok) {
                setEnquiries(await res.json());
            }
        } catch (err) {
            console.error('Failed to load enquiries:', err);
        }
        setLoading(false);
    };

    // Mark as read
    const markAsRead = async (enquiry: WebEnquiry) => {
        try {
            await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/web_enquiries?id=eq.${enquiry.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ read: true, status: 'Read' })
                }
            );
            setEnquiries(prev => prev.map(e => e.id === enquiry.id ? { ...e, read: true, status: 'Read' } : e));
        } catch (err) {
            console.error('Failed to update:', err);
        }
    };

    // Update status
    const updateStatus = async (id: number, newStatus: string) => {
        try {
            await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/web_enquiries?id=eq.${id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ status: newStatus, read: true })
                }
            );
            setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status: newStatus as any, read: true } : e));
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    // Save admin notes
    const saveAdminNotes = async () => {
        if (!selectedEnquiry) return;
        setSaving(true);
        try {
            await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/web_enquiries?id=eq.${selectedEnquiry.id}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ admin_notes: adminNotes, read: true, status: 'Read' })
                }
            );
            setEnquiries(prev => prev.map(e =>
                e.id === selectedEnquiry.id
                    ? { ...e, admin_notes: adminNotes, read: true, status: 'Read' }
                    : e
            ));
            setSelectedEnquiry(prev => prev ? { ...prev, admin_notes: adminNotes, read: true, status: 'Read' } : null);
        } catch (err) {
            console.error('Failed to save notes:', err);
        }
        setSaving(false);
    };

    // Delete enquiry
    const deleteEnquiry = async (id: number) => {
        if (!confirm('Are you sure you want to delete this enquiry?')) return;
        try {
            await fetch(
                `${getSupabaseBaseUrl()}/rest/v1/web_enquiries?id=eq.${id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`
                    }
                }
            );
            setEnquiries(prev => prev.filter(e => e.id !== id));
            if (selectedEnquiry?.id === id) {
                setDialogOpen(false);
                setSelectedEnquiry(null);
            }
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    };

    // View enquiry details
    const viewEnquiry = (enquiry: WebEnquiry) => {
        setSelectedEnquiry(enquiry);
        setAdminNotes(enquiry.admin_notes || '');
        setDialogOpen(true);
        if (!enquiry.read) {
            markAsRead(enquiry);
        }
    };

    // Status colors
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'New': return 'bg-blue-100 text-blue-800';
            case 'Read': return 'bg-yellow-100 text-yellow-800';
            case 'Replied': return 'bg-green-100 text-green-800';
            case 'Closed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Filter
    const filtered = enquiries.filter(e => {
        if (!searchQuery) return true;
        const s = searchQuery.toLowerCase();
        return (
            e.name.toLowerCase().includes(s) ||
            e.mobile.includes(s) ||
            e.email?.toLowerCase().includes(s) ||
            e.message.toLowerCase().includes(s)
        );
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

    // Stats
    const stats = {
        total: enquiries.length,
        unread: enquiries.filter(e => !e.read).length,
        replied: enquiries.filter(e => e.status === 'Replied').length,
        closed: enquiries.filter(e => e.status === 'Closed').length,
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                        Web Enquiries
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Messages from the website contact form
                    </p>
                </div>
                <Button onClick={loadEnquiries} variant="outline" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Total Enquiries</p>
                                <p className="text-2xl font-bold">{stats.total}</p>
                            </div>
                            <Globe className="h-8 w-8 text-teal-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Unread</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.unread}</p>
                            </div>
                            <Inbox className="h-8 w-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Replied</p>
                                <p className="text-2xl font-bold text-green-600">{stats.replied}</p>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-600">Closed</p>
                                <p className="text-2xl font-bold text-gray-600">{stats.closed}</p>
                            </div>
                            <Clock className="h-8 w-8 text-gray-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Search by name, mobile, email, or message..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                    className="pl-10"
                />
            </div>

            {/* Table */}
            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-teal-600" />
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            No enquiries found
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="p-3 text-left text-sm font-semibold">Name</th>
                                        <th className="p-3 text-left text-sm font-semibold">Contact</th>
                                        <th className="p-3 text-left text-sm font-semibold">Message</th>
                                        <th className="p-3 text-left text-sm font-semibold">Status</th>
                                        <th className="p-3 text-left text-sm font-semibold">Date</th>
                                        <th className="p-3 text-left text-sm font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((enquiry) => (
                                        <tr
                                            key={enquiry.id}
                                            className={`border-b hover:bg-gray-50 cursor-pointer transition-colors ${!enquiry.read ? 'bg-blue-50/50 font-medium' : ''}`}
                                            onClick={() => viewEnquiry(enquiry)}
                                        >
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    {!enquiry.read && (
                                                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                                    )}
                                                    <span className="text-sm">{enquiry.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <div className="text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <Phone className="h-3 w-3 text-gray-400" />
                                                        {enquiry.mobile}
                                                    </div>
                                                    {enquiry.email && (
                                                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                                            <Mail className="h-3 w-3" />
                                                            {enquiry.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <p className="text-sm text-gray-600 truncate max-w-[250px]">
                                                    {enquiry.message}
                                                </p>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(enquiry.status)}`}>
                                                    {enquiry.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-gray-500">
                                                {new Date(enquiry.created_at).toLocaleDateString('en-IN', {
                                                    day: '2-digit', month: 'short', year: 'numeric'
                                                })}
                                                <br />
                                                <span className="text-xs">
                                                    {new Date(enquiry.created_at).toLocaleTimeString('en-IN', {
                                                        hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <Button size="sm" variant="ghost" onClick={() => viewEnquiry(enquiry)} title="View">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => deleteEnquiry(enquiry.id)}
                                                        title="Delete"
                                                        className="text-red-600 hover:text-red-800"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                                className="border rounded px-2 py-1 text-sm"
                            >
                                {[10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                                Previous
                            </Button>
                            <span className="text-sm px-4">Page {page + 1} / {totalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                                Next
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-teal-600" />
                            Enquiry from {selectedEnquiry?.name}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedEnquiry && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500 text-xs">Name</p>
                                    <p className="font-medium flex items-center gap-1">
                                        <User className="h-3 w-3" /> {selectedEnquiry.name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-gray-500 text-xs">Mobile</p>
                                    <p className="font-medium flex items-center gap-1">
                                        <Phone className="h-3 w-3" /> {selectedEnquiry.mobile}
                                    </p>
                                </div>
                                {selectedEnquiry.email && (
                                    <div className="col-span-2">
                                        <p className="text-gray-500 text-xs">Email</p>
                                        <p className="font-medium flex items-center gap-1">
                                            <Mail className="h-3 w-3" /> {selectedEnquiry.email}
                                        </p>
                                    </div>
                                )}
                                <div className="col-span-2">
                                    <p className="text-gray-500 text-xs">Received on</p>
                                    <p className="font-medium">
                                        {new Date(selectedEnquiry.created_at).toLocaleString('en-IN', {
                                            dateStyle: 'medium', timeStyle: 'short'
                                        })}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <p className="text-gray-500 text-xs mb-1">Message</p>
                                <div className="bg-gray-50 p-4 rounded-lg text-sm whitespace-pre-wrap border">
                                    {selectedEnquiry.message}
                                </div>
                            </div>

                            <div>
                                <p className="text-gray-500 text-xs mb-1">Status</p>
                                <select
                                    value={selectedEnquiry.status}
                                    onChange={(e) => {
                                        updateStatus(selectedEnquiry.id, e.target.value);
                                        setSelectedEnquiry({ ...selectedEnquiry, status: e.target.value as any });
                                    }}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium border cursor-pointer ${getStatusColor(selectedEnquiry.status)}`}
                                >
                                    <option value="New">New</option>
                                    <option value="Read">Read</option>
                                    <option value="Replied">Replied</option>
                                    <option value="Closed">Closed</option>
                                </select>
                            </div>

                            <div>
                                <p className="text-gray-500 text-xs mb-1">Admin Notes</p>
                                <textarea
                                    title="admin-notes"
                                    rows={3}
                                    className="w-full p-3 border rounded-lg text-sm resize-none"
                                    placeholder="Add internal notes about this enquiry..."
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                />
                                <Button
                                    size="sm"
                                    className="mt-2"
                                    onClick={saveAdminNotes}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Notes'}
                                </Button>
                            </div>

                            <div className="flex justify-between pt-4 border-t">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteEnquiry(selectedEnquiry.id)}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </Button>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
