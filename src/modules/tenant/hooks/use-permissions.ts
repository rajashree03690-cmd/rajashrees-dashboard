import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useTenant } from '../components/tenant-provider';

/**
 * Fetch user's permissions within current tenant
 */
export function usePermissions() {
    const { tenantId } = useTenant();

    return useQuery({
        queryKey: ['permissions', tenantId],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return { data: [], error: 'Not authenticated' };

            // Get user's role in this tenant
            const { data: membership } = await supabase
                .from('tenant_users')
                .select('role')
                .eq('tenant_id', tenantId)
                .eq('user_id', user.id)
                .eq('status', 'active')
                .single();

            if (!membership) return { data: [], error: 'Not a member' };

            // Get permissions for this role
            const { data: permissions, error } = await supabase
                .from('role_permissions')
                .select(`
          permission:permissions(name)
        `)
                .eq('role_id', (
                    await supabase
                        .from('roles')
                        .select('id')
                        .eq('name', membership.role)
                        .single()
                ).data?.id);

            if (error) return { data: [], error: error.message };

            const permissionNames = permissions
                ?.map(p => (p.permission as any)?.name)
                .filter(Boolean) || [];

            return { data: permissionNames, error: undefined };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Check if user has specific permission
 */
export function useHasPermission(permissionName: string): boolean {
    const { data } = usePermissions();
    return (data?.data as string[] | undefined)?.includes(permissionName) || false;
}
