import { supabase } from '@/lib/supabase';
import type { Customer } from '@/types/customers';

export const customersService = {
    /**
     * Fetch all customers (matching Flutter fetchCustomers)
     */
    async fetchCustomers(): Promise<Customer[]> {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching customers:', error);
            throw error;
        }

        return data || [];
    },
};
