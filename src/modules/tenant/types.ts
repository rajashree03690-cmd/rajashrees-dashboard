export interface Tenant {
    id: string;
    name: string;
    slug: string;
    subdomain?: string;
    plan_type: 'free' | 'starter' | 'professional' | 'enterprise';
    subscription_status: 'active' | 'trial' | 'suspended' | 'cancelled';
    trial_ends_at?: string;
    billing_email?: string;
    max_users: number;
    max_storage_gb: number;
    settings: Record<string, any>;
    metadata: Record<string, any>;
    created_at: string;
    updated_at: string;
    is_Active: boolean;
}

export interface TenantMembership {
    id: string;
    tenant_id: string;
    user_id: string;
    role: 'tenant_admin' | 'staff' | 'readonly' | 'viewer';
    status: 'active' | 'invited' | 'suspended';
    invited_by?: string;
    invited_at?: string;
    joined_at?: string;
    created_at: string;
    updated_at: string;

    // Joined data
    tenant?: Tenant;
}

export interface Role {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    level: number;
    is_system: boolean;
}

export interface Permission {
    id: string;
    resource: string;
    action: string;
    scope: 'tenant' | 'own' | 'all';
    name: string;
    description?: string;
}
