import { useQuery } from '@tanstack/react-query';
import { tenantService } from '../services/tenant.service';

export function useTenantMembership(userId: string | undefined) {
    return useQuery({
        queryKey: ['tenant-memberships', userId],
        queryFn: async () => {
            if (!userId) throw new Error('User ID required');
            return tenantService.getUserMemberships(userId);
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

export function useTenantDetails(tenantId: string | undefined) {
    return useQuery({
        queryKey: ['tenant', tenantId],
        queryFn: async () => {
            if (!tenantId) throw new Error('Tenant ID required');
            return tenantService.getTenantById(tenantId);
        },
        enabled: !!tenantId,
        staleTime: 10 * 60 * 1000, // 10 minutes
    });
}
