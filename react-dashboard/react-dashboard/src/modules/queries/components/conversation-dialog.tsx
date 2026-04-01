'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { queriesService } from '@/modules/queries/services/queries.service';
import type { Query, QueryConversation } from '@/types/queries';
import { Mail, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ConversationDialogProps {
    open: boolean;
    onClose: () => void;
    query: Query;
}

export function ConversationDialog({ open, onClose, query }: ConversationDialogProps) {
    const [conversations, setConversations] = useState<QueryConversation[]>([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendViaEmail, setSendViaEmail] = useState(true); // Default: send via email
    const [emailSent, setEmailSent] = useState(false);

    const customerEmail = query.email || query.customer_email || '';
    const customerName = query.name || 'Customer';

    useEffect(() => {
        if (open) {
            loadConversations();
            setEmailSent(false);
        }
    }, [open]);

    const loadConversations = async () => {
        const result = await queriesService.fetchConversations(query.query_id!);
        if (result.data) {
            setConversations(result.data);
        }
    };

    const handleSend = async () => {
        if (!message.trim()) return;

        setLoading(true);
        setEmailSent(false);

        // 1. Save conversation to DB
        const result = await queriesService.addConversation({
            query_id: query.query_id,
            sender_type: 'Admin',
            sender_name: 'Support Team',
            message,
        });

        if (result.success) {
            // 2. Send email if checkbox is checked
            if (sendViaEmail && customerEmail) {
                const emailResult = await queriesService.sendReplyEmail({
                    customerEmail,
                    customerName,
                    queryId: query.query_id!,
                    replyMessage: message,
                    originalMessage: query.message,
                });

                if (emailResult.success) {
                    setEmailSent(true);
                    toast.success(`Reply sent & emailed to ${customerEmail}`);
                } else {
                    toast.warning(`Reply saved but email failed: ${emailResult.error}`);
                }
            } else {
                toast.success('Reply saved to conversation');
            }

            setMessage('');
            await loadConversations();
        } else {
            toast.error('Failed to send message');
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[700px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                        <span>Conversation - Query #{query.query_id}</span>
                    </DialogTitle>
                    {/* Customer Info */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                        <span className="font-medium text-gray-700">{customerName}</span>
                        {customerEmail && (
                            <span className="flex items-center gap-1">
                                <Mail className="w-3.5 h-3.5" />
                                {customerEmail}
                            </span>
                        )}
                    </div>
                </DialogHeader>

                {/* Conversation Thread */}
                <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-gray-50 rounded-lg min-h-[300px] max-h-[350px]">
                    {/* Show original message at the top */}
                    {query.message && conversations.length === 0 && (
                        <div className="flex justify-start">
                            <div className="max-w-[70%] rounded-lg p-3 bg-white border">
                                <div className="text-xs opacity-75 mb-1">
                                    {customerName} • {query.created_at ? new Date(query.created_at).toLocaleString() : 'N/A'}
                                </div>
                                <div>{query.message}</div>
                            </div>
                        </div>
                    )}
                    {conversations.length === 0 && !query.message ? (
                        <div className="text-center text-gray-500 py-8">No conversation yet</div>
                    ) : (
                        conversations.map((conv) => {
                            const isCustomer = conv.sender_type === 'Customer' || conv.sender_type === 'WhatsApp' || conv.sender_type === 'System';
                            return (
                                <div
                                    key={conv.conversation_id}
                                    className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div className={`max-w-[70%] rounded-lg p-3 ${isCustomer
                                        ? 'bg-white border'
                                        : 'bg-purple-600 text-white'
                                        }`}>
                                        <div className="text-xs opacity-75 mb-1">
                                            {conv.sender_name || conv.sender_type} • {new Date(conv.timestamp!).toLocaleString()}
                                        </div>
                                        <div>{conv.message}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Reply Input */}
                <div className="space-y-3">
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your reply..."
                        className="w-full px-3 py-2 border rounded-md min-h-[80px]"
                    />

                    <div className="flex items-center justify-between">
                        {/* Email toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={sendViaEmail}
                                onChange={(e) => setSendViaEmail(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="text-sm text-gray-600">
                                Send via email
                                {customerEmail ? ` (${customerEmail})` : ' (no email available)'}
                            </span>
                        </label>

                        <div className="flex items-center gap-2">
                            {emailSent && (
                                <span className="flex items-center gap-1 text-xs text-green-600">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Email sent
                                </span>
                            )}
                            <Button
                                onClick={handleSend}
                                disabled={loading || !message.trim()}
                                className="flex items-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                {loading ? 'Sending...' : sendViaEmail ? 'Send & Email' : 'Send Reply'}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
