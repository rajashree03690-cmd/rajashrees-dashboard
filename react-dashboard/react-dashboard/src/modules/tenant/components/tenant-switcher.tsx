'use client';

import { useState } from 'react';
import { useTenant } from '@/modules/tenant';
import { useTenantMembership } from '@/modules/tenant/hooks/use-tenant-membership';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Building2, ChevronDown, LogOut } from 'lucide-react';

export function TenantSwitcher() {
    const router = useRouter();
    const { tenantName, tenantSlug } = useTenant();
    const [userId, setUserId] = useState<string | null>(null);

    // Get current user ID
    useState(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) setUserId(data.user.id);
        });
    });

    const { data: memberships, isLoading } = useTenantMembership(userId || undefined);

    const handleSwitch = (slug: string) => {
        router.push(`/${slug}/dashboard`);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (isLoading || !memberships?.data) {
        return (
            <Button variant="outline" size="sm" disabled>
                <Building2 className="h-4 w-4 mr-2" />
                Loading...
            </Button>
        );
    }

    const otherTenants = memberships.data.filter(m => m.tenant?.slug !== tenantSlug);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                    <Building2 className="h-4 w-4 mr-2" />
                    {tenantName || 'Organization'}
                    <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Current Organization</DropdownMenuLabel>
                <DropdownMenuItem disabled className="font-medium">
                    {tenantName}
                </DropdownMenuItem>

                {otherTenants.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Switch to</DropdownMenuLabel>
                        {otherTenants.map((membership) => (
                            <DropdownMenuItem
                                key={membership.tenant?.id}
                                onClick={() => membership.tenant && handleSwitch(membership.tenant.slug)}
                            >
                                <Building2 className="h-4 w-4 mr-2" />
                                {membership.tenant?.name}
                            </DropdownMenuItem>
                        ))}
                    </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
