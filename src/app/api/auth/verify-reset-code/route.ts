import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const supabase = createServerClient();
        const { email, code } = await request.json();

        if (!email || !code || code.length !== 6) {
            return NextResponse.json(
                { error: 'Email and 6-digit code are required' },
                { status: 400 }
            );
        }

        // Look up the OTP record
        const { data: otpRecord, error } = await supabase
            .from('password_reset_otps')
            .select('*')
            .eq('email', email)
            .eq('otp', code)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !otpRecord) {
            return NextResponse.json(
                { error: 'Invalid code. Please check and try again.' },
                { status: 400 }
            );
        }

        // Mark as used
        await supabase
            .from('password_reset_otps')
            .update({ used: true })
            .eq('otp_id', otpRecord.otp_id);

        return NextResponse.json({
            success: true,
            message: 'Code verified successfully',
        });

    } catch (error: any) {
        console.error('Verify reset code error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
