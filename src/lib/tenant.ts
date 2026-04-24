/**
 * Central Tenant Resolver
 * 
 * CRITICAL: This is the ONLY place to change when enabling multi-tenancy.
 * Current Mode: Single-tenant (returns null)
 * Future Mode: Return userContext.tenantId
 * 
 * All services MUST use this function for tenant filtering.
 */

export function getTenantId(): string | null {
    // Single-tenant mode - all data uses tenant_id = NULL
    return null;

    // Future multi-tenant implementation:
    // const { tenantId } = useUserContext();
    // return tenantId;
}

/**
 * Tenant-aware query filter helper
 * Usage: .eq('tenant_id', getTenantFilter())
 * @deprecated Use applyTenantFilter() instead — .eq() cannot match NULL in PostgREST
 */
export function getTenantFilter(): string | null {
    return getTenantId();
}

/**
 * Apply the correct tenant filter to a Supabase query builder.
 * Uses .is('tenant_id', null) for single-tenant mode (NULL tenant),
 * and .eq('tenant_id', id) for multi-tenant mode.
 */
export function applyTenantFilter<T extends { is: Function; eq: Function }>(query: T, column = 'tenant_id'): T {
    const tenantId = getTenantId();
    if (tenantId === null) {
        return query.is(column, null);
    }
    return query.eq(column, tenantId);
}
