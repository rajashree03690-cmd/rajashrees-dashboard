import type { Query, QueryConversation, QueryStatus, QuerySource } from '@/types/queries';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

class QueriesService {
    /**
     * Fetch all queries
     */
    async fetchQueries(): Promise<{ data: Query[]; error?: string }> {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/queries?select=*,customers(source,full_name,mobile_number)&order=created_at.desc`,
                {
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                    },
                }
            );

            if (!response.ok) {
                return { data: [], error: 'Failed to fetch queries' };
            }

            const data = await response.json();
            return { data };
        } catch (error) {
            console.error('Error fetching queries:', error);
            return { data: [], error: String(error) };
        }
    }

    /**
     * Add new query (manual - Phone source)
     */
    async addQuery(query: Partial<Query>): Promise<{ success: boolean; error?: string; data?: Query }> {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/queries`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation',
                    },
                    body: JSON.stringify({
                        customer_id: query.customer_id,
                        name: query.name,
                        mobile_number: query.mobile_number,
                        email: query.email,
                        message: query.message,
                        status: query.status || 'Open',
                        order_id: query.order_id,
                        priority: query.priority || (query.order_id ? 'High' : 'Medium'),
                        source: query.source || 'Phone',
                        remarks: query.remarks,
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                return { success: false, error: error.message || 'Failed to add query' };
            }

            const data = await response.json();
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Error adding query:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Update query status
     */
    async updateStatus(queryId: number, status: QueryStatus): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/queries?query_id=eq.${queryId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        status,
                        updated_at: new Date().toISOString(),
                    }),
                }
            );

            if (!response.ok) {
                return { success: false, error: 'Failed to update status' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating status:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Update query details
     */
    async updateQuery(queryId: number, updates: Partial<Query>): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/queries?query_id=eq.${queryId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...updates,
                        updated_at: new Date().toISOString(),
                    }),
                }
            );

            if (!response.ok) {
                return { success: false, error: 'Failed to update query' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error updating query:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Update remarks
     */
    async updateRemarks(queryId: number, remarks: string): Promise<{ success: boolean; error?: string }> {
        return this.updateQuery(queryId, { remarks });
    }

    /**
     * Delete query
     */
    async deleteQuery(queryId: number): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/queries?query_id=eq.${queryId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                    },
                }
            );

            if (!response.ok) {
                return { success: false, error: 'Failed to delete query' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error deleting query:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Fetch conversations for a query (Dual-table fetch)
     */
    async fetchConversations(queryId: number): Promise<{ data: QueryConversation[]; error?: string }> {
        try {
            // Fetch from both tables in parallel to ensure we don't miss data
            const [messagesResponse, conversationsResponse] = await Promise.all([
                fetch(
                    `${SUPABASE_URL}/rest/v1/query_messages?query_id=eq.${queryId}&order=sent_at.asc`,
                    { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
                ),
                fetch(
                    `${SUPABASE_URL}/rest/v1/query_conversations?query_id=eq.${queryId}&order=timestamp.asc`,
                    { headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` } }
                )
            ]);

            let mergedData: QueryConversation[] = [];

            // Process query_messages (legacy/other table)
            if (messagesResponse.ok) {
                const messagesData = await messagesResponse.json();
                const mappedMessages = messagesData.map((msg: any) => ({
                    conversation_id: msg.message_id,
                    query_id: msg.query_id,
                    sender_type: msg.sender_type.charAt(0).toUpperCase() + msg.sender_type.slice(1), // Normalize to Title Case
                    sender_name: msg.sender_type.charAt(0).toUpperCase() + msg.sender_type.slice(1),
                    message: msg.message,
                    timestamp: msg.sent_at,
                }));
                mergedData = [...mergedData, ...mappedMessages];
            }

            // Process query_conversations (new/target table)
            if (conversationsResponse.ok) {
                const conversationsData = await conversationsResponse.json();
                // No mapping needed if it matches interface, but ensured just in case
                mergedData = [...mergedData, ...conversationsData];
            }

            // Sort merged results by timestamp
            mergedData.sort((a, b) => {
                return new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime();
            });

            return { data: mergedData };
        } catch (error) {
            console.error('Error fetching conversations:', error);
            return { data: [], error: String(error) };
        }
    }

    /**
     * Add conversation message (Dual-write compatible)
     */
    async addConversation(conversation: Partial<QueryConversation>): Promise<{ success: boolean; error?: string }> {
        try {
            // Priority: Try query_conversations (new system)
            const responseV2 = await fetch(
                `${SUPABASE_URL}/rest/v1/query_conversations`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation',
                    },
                    body: JSON.stringify({
                        query_id: conversation.query_id,
                        sender_type: conversation.sender_type, // 'Admin' (Title Case)
                        sender_name: conversation.sender_name,
                        message: conversation.message,
                        timestamp: new Date().toISOString(),
                    }),
                }
            );

            if (responseV2.ok) {
                return { success: true };
            }

            // Fallback: Try query_messages (legacy system) if V2 failed
            // Note: We lowercase sender_type for V1 compatibility
            const responseV1 = await fetch(
                `${SUPABASE_URL}/rest/v1/query_messages`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation',
                    },
                    body: JSON.stringify({
                        query_id: conversation.query_id,
                        sender_type: conversation.sender_type?.toLowerCase(), // 'admin' (lowercase)
                        message: conversation.message,
                        sent_at: new Date().toISOString(),
                    }),
                }
            );

            if (!responseV1.ok) {
                const error = await responseV1.json();
                return { success: false, error: error.message || 'Failed to add conversation' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error adding conversation:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Mark query as escalated
     */
    async markAsEscalated(queryId: number, ticketId: number): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/queries?query_id=eq.${queryId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': ANON_KEY,
                        'Authorization': `Bearer ${ANON_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        is_escalated: true,
                        escalated_ticket_id: ticketId,
                        status: 'Escalated',
                        updated_at: new Date().toISOString(),
                    }),
                }
            );

            if (!response.ok) {
                return { success: false, error: 'Failed to mark as escalated' };
            }

            return { success: true };
        } catch (error) {
            console.error('Error marking as escalated:', error);
            return { success: false, error: String(error) };
        }
    }
}

export const queriesService = new QueriesService();
