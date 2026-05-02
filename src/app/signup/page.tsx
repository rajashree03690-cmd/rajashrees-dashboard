'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { tenantService } from '@/modules/tenant/services/tenant.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function SignupPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const fullName = formData.get('full_name') as string;
        const companyName = formData.get('company_name') as string;

        try {
            // 1. Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('User creation failed');

            // 2. Create user profile
            const { error: profileError } = await supabase
                .from('user_profiles')
                .insert({
                    id: authData.user.id,
                    full_name: fullName,
                    email_verified: false,
                });

            if (profileError) {
                console.error('Profile creation error:', profileError);
                // Continue anyway - profile might already exist
            }

            // 3. Create tenant
            const { data: tenant, error: tenantError } = await tenantService.createTenant(
                companyName,
                authData.user.id
            );

            if (tenantError || !tenant) {
                throw new Error(tenantError || 'Failed to create organization');
            }

            // 4. Redirect to tenant dashboard
            router.push('/dashboard');
        } catch (err: any) {
            console.error('Signup error:', err);
            setError(err.message || 'Failed to create account');
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Create an Account</CardTitle>
                    <CardDescription className="text-center">
                        Sign up to create your organization
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="full_name">Full Name</Label>
                            <Input
                                id="full_name"
                                name="full_name"
                                placeholder="Enter your full name"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="john@company.com"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company_name">Organization Name</Label>
                            <Input
                                id="company_name"
                                name="company_name"
                                placeholder="Acme Corp"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="Minimum 8 characters"
                                minLength={8}
                                required
                                disabled={loading}
                            />
                        </div>

                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-purple-600 hover:bg-purple-700"
                            disabled={loading}
                        >
                            {loading ? 'Creating account...' : 'Sign Up'}
                        </Button>
                    </form>

                    <div className="mt-4 text-center text-sm">
                        Already have an account?{' '}
                        <Link href="/login" className="text-purple-600 hover:underline">
                            Sign in
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
