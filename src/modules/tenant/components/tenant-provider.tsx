'use client';

import { createContext, useContext, ReactNode } from 'react';

interface TenantContextValue {
    tenantId: string | null;
    tenantSlug: string | null;
    tenantName: string | null;
}

const TenantContext = createContext<TenantContextValue>({
    tenantId: null,
    tenantSlug: null,
    tenantName: null,
});

interface TenantProviderProps {
    children: ReactNode;
    tenantId: string;
    tenantSlug: string;
    tenantName?: string;
}

export function TenantProvider({
    children,
    tenantId,
    tenantSlug,
    tenantName
}: TenantProviderProps) {
    return (
        <TenantContext.Provider
            value={{
                tenantId,
                tenantSlug,
                tenantName: tenantName || null
            }}
        >
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const context = useContext(TenantContext);
    if (!context.tenantId) {
        throw new Error('useTenant must be used within TenantProvider');
    }
    return context;
}

export function useTenantOptional() {
    return useContext(TenantContext);
}
