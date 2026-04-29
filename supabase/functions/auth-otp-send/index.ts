import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { email, purpose = 'registration' } = await req.json()

        if (!email) {
            return new Response(
                JSON.stringify({ success: false, error: 'Email is required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create Supabase admin client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry

        // 1. Store code in DB
        console.log(`[AUTH] Attempting to store OTP for ${email.toLowerCase()} in DB...`)
        const { error: insertError } = await supabase
            .from('password_reset_otps')
            .insert({
                email: email.toLowerCase(),
                otp: otp,
                expires_at: expiresAt.toISOString(),
                used: false,
                purpose: purpose // 'registration' or 'password_reset'
            })

        if (insertError) {
            console.error('[AUTH] DB Insert Error:', insertError)
            return new Response(
                JSON.stringify({ success: false, error: 'Failed to generate verification code', details: insertError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
        console.log(`[AUTH] OTP stored successfully for ${email}`)

        // ── Dev bypass: skip Resend for test emails ──
        // This allows testing the auth flow when Resend quota is exhausted.
        // Test accounts use a fixed OTP '123456' instead of the random one.
        const DEV_BYPASS_EMAILS = ['test@rajashreefashion.com', 'dev@rajashreefashion.com', 'demo@rajashreefashion.com']
        if (DEV_BYPASS_EMAILS.includes(email.toLowerCase())) {
            // Overwrite with known OTP for dev testing
            await supabase
                .from('password_reset_otps')
                .update({ otp: '123456' })
                .eq('email', email.toLowerCase())
                .eq('used', false)
                .order('created_at', { ascending: false })
                .limit(1)

            console.log(`[AUTH] Dev bypass: OTP set to 123456 for ${email}`)
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Verification code sent to your email',
                    email: email,
                    _dev_note: 'Bypass active — use OTP: 123456'
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Send OTP via Resend
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (!resendApiKey) {
            console.error('RESEND_API_KEY not configured')
            return new Response(
                JSON.stringify({ success: false, error: 'Email service not configured' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const emailSubject = purpose === 'registration'
            ? 'Verify Your Email - Rajashree Fashion'
            : 'Password Reset Code - Rajashree Fashion'

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="https://www.rajashreefashion.com/logo.jpg" alt="Rajashree Fashion" style="height: 80px;">
                    <h1 style="color: #e11d48; margin-top: 10px;">Rajashree Fashion</h1>
                </div>
                
                <div style="background: linear-gradient(135deg, #fff1f2, #ffffff); border-radius: 16px; padding: 30px; border: 1px solid #fecdd3;">
                    <h2 style="color: #1f2937; margin-top: 0;">
                        ${purpose === 'registration' ? 'Welcome! Verify Your Email' : 'Reset Your Password'}
                    </h2>
                    <p style="color: #6b7280; font-size: 16px;">
                        ${purpose === 'registration'
                ? 'Thank you for signing up with Rajashree Fashion. Use the code below to verify your email:'
                : 'Use the code below to reset your password:'}
                    </p>
                    
                    <div style="background: #ffffff; border: 2px dashed #e11d48; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #e11d48;">${otp}</span>
                    </div>
                    
                    <p style="color: #9ca3af; font-size: 14px;">
                        This code will expire in <strong>10 minutes</strong>.
                    </p>
                    <p style="color: #9ca3af; font-size: 14px;">
                        If you didn't request this, please ignore this email.
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; color: #9ca3af; font-size: 12px;">
                    <p>© ${new Date().getFullYear()} Rajashree Fashion. All rights reserved.</p>
                    <p>Shop the latest trends at <a href="https://www.rajashreefashion.com" style="color: #e11d48;">rajashreefashion.com</a></p>
                </div>
            </div>
        `

        console.log(`[AUTH] Attempting to send email via Resend for ${email}...`)
        const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Rajashree Fashion <noreply@rajashreefashion.com>',
                to: [email],
                subject: emailSubject,
                html: emailHtml,
            }),
        })

        const emailResult = await emailResponse.json()

        if (!emailResponse.ok) {
            console.error('[AUTH] Resend API Error:', emailResult)
            return new Response(
                JSON.stringify({ success: false, error: 'Failed to send verification email', details: emailResult }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`✅ OTP sent successfully to ${email} for ${purpose}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Verification code sent to your email',
                email: email
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('OTP send error:', error)
        return new Response(
            JSON.stringify({ success: false, error: 'Internal server error', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
