import { supabase } from '@/lib/supabase';
import { getSupabaseBaseUrl, getSupabaseAnonKey } from '@/lib/supabase-url';
import type { Combo, ComboFormData, ComboItem } from '@/types/combos';

export const combosService = {
    /**
     * Fetch all combos
     */
    async fetchCombos(): Promise<Combo[]> {
        try {
            const { data, error } = await supabase.functions.invoke('get-combos');
            if (error) throw error;
            return data.data || [];
        } catch (error) {
            console.error('Error fetching combos:', error);
            // Fallback to DB if needed, but for now throwing
            throw error;
        }
    },

    /**
     * Fetch single combo by ID with items
     */
    async fetchComboById(comboId: number): Promise<{ combo: Combo; items: ComboItem[] }> {
        try {
            const { data, error } = await supabase.functions.invoke('get-combos', {
                top: { id: comboId.toString() } // Pass as query param? No, invoke body or params.
            });

            // The invoke method supports body, but for GET params usually better to append to URL if using raw fetch.
            // But supabase-js functions.invoke sends POST by default unless method specified.
            // Our Edge Function supports query params for GET.
            // Let's use direct URL construction for GET to pass query params cleanly

            const response = await fetch(
                `${getSupabaseBaseUrl()}/functions/v1/get-combos?id=${comboId}`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': getSupabaseAnonKey(),
                        'Authorization': `Bearer ${getSupabaseAnonKey()}`,
                    }
                }
            );

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to fetch combo');
            }

            const result = await response.json();
            return {
                combo: result.combo,
                items: result.items || []
            };
        } catch (error) {
            console.error('Error fetching combo:', error);
            throw error;
        }
    },

    /**
     * Create new combo
     */
    async createCombo(formData: ComboFormData): Promise<Combo> {
        const { data, error } = await supabase.functions.invoke('create-combo-with-items', {
            body: formData
        });

        if (error) throw error;

        // The edge function returns { combo_id, ... }, we need the full object to return.
        // We can refetch it.
        const { combo } = await this.fetchComboById(data.combo_id);
        return combo;
    },

    /**
     * Update existing combo
     */
    async updateCombo(comboId: number, formData: ComboFormData): Promise<Combo> {
        const payload = {
            ...formData,
            combo_id: comboId // Ensure ID is in body as fallback
        };

        const { data, error } = await supabase.functions.invoke('update-combo-with-items', {
            body: payload,
            headers: {
                'combo-id': comboId.toString()
            }
        });

        if (error) throw error;

        // Refetch to return updated object
        const { combo } = await this.fetchComboById(comboId);
        return combo;
    },

    /**
     * Disable combo (soft delete)
     */
    async disableCombo(comboId: number): Promise<void> {
        const { error } = await supabase
            .from('combo')
            .update({ is_Active: false, updated_at: new Date().toISOString() })
            .eq('combo_id', comboId);

        if (error) {
            console.error('Error disabling combo:', error);
            throw error;
        }
    },

    /**
     * Enable combo
     */
    async enableCombo(comboId: number): Promise<void> {
        const { error } = await supabase
            .from('combo')
            .update({ is_Active: true, updated_at: new Date().toISOString() })
            .eq('combo_id', comboId);

        if (error) {
            console.error('Error enabling combo:', error);
            throw error;
        }
    }
};
