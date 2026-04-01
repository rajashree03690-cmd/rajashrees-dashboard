import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const supabase = createServerClient();
        const { email, token, password } = await request.json();

        if (!email || !token || !password) {
            return NextResponse.json(
                { error: 'All fields are required' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Verify that this email has a recently verified OTP
        const { data: otpRecord, error: otpError } = await supabase
            .from('password_reset_otps')
            .select('*')
            .eq('email', email)
            .eq('used', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (otpError || !otpRecord) {
            return NextResponse.json(
                { error: 'No verified reset code found. Please verify your code first.' },
                { status: 400 }
            );
        }

        // Check if not too old (1 hour from creation)
        const createdAt = new Date(otpRecord.created_at);
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        if (createdAt < oneHourAgo) {
            return NextResponse.json(
                { error: 'Reset link has expired' },
                { status: 400 }
            );
        }

        // Verify user exists
        const { data: user } = await supabase
            .from('dashboard_users')
            .select('id, email')
            .eq('email', email)
            .single();

        // Update user password
        const { error: updateError } = await supabase
            .from('dashboard_users')
            .update({ password })
            .eq('email', email);

        if (updateError) {
            console.error('Password update error:', updateError);
            return NextResponse.json(
                { error: 'Failed to reset password' },
                { status: 500 }
            );
        }

        // Delete used OTP record
        await supabase
            .from('password_reset_otps')
            .delete()
            .eq('otp_id', otpRecord.otp_id);

        return NextResponse.json({
            message: 'Password reset successfully',
        });

    } catch (error: any) {
        console.error('Password reset error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
