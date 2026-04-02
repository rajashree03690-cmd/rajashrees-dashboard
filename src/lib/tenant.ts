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
 */
export function getTenantFilter(): string | null {
    return getTenantId();
}
