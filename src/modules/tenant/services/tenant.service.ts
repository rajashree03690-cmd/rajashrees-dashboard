import { supabase } from '@/lib/supabase';
import type { Tenant, TenantMembership } from '../types';

export const tenantService = {
    /**
     * Get tenant by slug
     */
    async getTenantBySlug(slug: string): Promise<{ data: Tenant | null; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('slug', slug)
                .eq('is_Active', true)
                .is('deleted_at', null)
                .single();

            if (error) {
                console.error('Error fetching tenant:', error);
                return { data: null, error: error.message };
            }

            return { data };
        } catch (error) {
            return { data: null, error: String(error) };
        }
    },

    /**
     * Get tenant by ID
     */
    async getTenantById(id: string): Promise<{ data: Tenant | null; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', id)
                .eq('is_Active', true)
                .is('deleted_at', null)
                .single();

            if (error) {
                return { data: null, error: error.message };
            }

            return { data };
        } catch (error) {
            return { data: null, error: String(error) };
        }
    },

    /**
     * Get user's tenant memberships
     */
    async getUserMemberships(userId: string): Promise<{ data: TenantMembership[]; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('tenant_users')
                .select(`
          *,
          tenant:tenants(*)
        `)
                .eq('user_id', userId)
                .eq('status', 'active');

            if (error) {
                return { data: [], error: error.message };
            }

            return { data: data || [] };
        } catch (error) {
            return { data: [], error: String(error) };
        }
    },

    /**
     * Check if user has access to tenant
     */
    async checkTenantAccess(userId: string, tenantId: string): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('tenant_users')
                .select('id')
                .eq('user_id', userId)
                .eq('tenant_id', tenantId)
                .eq('status', 'active')
                .single();

            return !error && !!data;
        } catch {
            return false;
        }
    },

    /**
     * Create new tenant (signup flow)
     */
    async createTenant(
        name: string,
        createdBy: string
    ): Promise<{ data: Tenant | null; error?: string }> {
        try {
            // Generate slug from name
            const slug = name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');

            const { data, error } = await supabase
                .from('tenants')
                .insert({
                    name,
                    slug,
                    created_by: createdBy,
                    plan_type: 'free',
                    subscription_status: 'trial',
                    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
                })
                .select()
                .single();

            if (error) {
                return { data: null, error: error.message };
            }

            // Add creator as tenant_admin
            await this.addUserToTenant(data.id, createdBy, 'tenant_admin');

            return { data };
        } catch (error) {
            return { data: null, error: String(error) };
        }
    },

    /**
     * Add user to tenant
     */
    async addUserToTenant(
        tenantId: string,
        userId: string,
        role: 'tenant_admin' | 'staff' | 'readonly' | 'viewer'
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('tenant_users')
                .insert({
                    tenant_id: tenantId,
                    user_id: userId,
                    role,
                    status: 'active',
                    joined_at: new Date().toISOString(),
                });

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },

    /**
     * Update tenant settings
     */
    async updateTenant(
        tenantId: string,
        updates: Partial<Tenant>
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('tenants')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', tenantId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    },
};
