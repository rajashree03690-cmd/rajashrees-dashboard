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
        const { email, otp, purpose = 'registration' } = await req.json()

        if (!email || !otp) {
            return new Response(
                JSON.stringify({ success: false, error: 'Email and OTP are required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Create Supabase admin client
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Verify OTP from database
        const { data: otpRecord, error: fetchError } = await supabase
            .from('password_reset_otps')
            .select('*')
            .eq('email', email.toLowerCase())
            .eq('otp', otp)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (fetchError || !otpRecord) {
            console.error('OTP verification failed:', fetchError)
            return new Response(
                JSON.stringify({ success: false, error: 'Invalid or expired verification code' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // Mark OTP as used
        await supabase
            .from('password_reset_otps')
            .update({ used: true })
            .eq('id', otpRecord.id)

        console.log(`✅ OTP verified successfully for ${email}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Email verified successfully',
                verified: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('OTP verification error:', error)
        return new Response(
            JSON.stringify({ success: false, error: 'Internal server error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
