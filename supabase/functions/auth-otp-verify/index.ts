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

        // 1. Generate magic link for the verified user
        console.log(`[AUTH] Generating magic link for ${email}...`)
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email.toLowerCase(),
        })

        if (linkError || !linkData?.properties?.action_link) {
            console.error('[AUTH] Failed to generate session link:', linkError)
            return new Response(
                JSON.stringify({ success: false, error: 'Failed to establish session' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const actionLink = linkData.properties.action_link

        // 2. Fetch the magic link to execute the login flow and get the token
        console.log(`[AUTH] Resolving session tokens...`)
        const verifyRes = await fetch(actionLink, { redirect: 'manual' })
        const location = verifyRes.headers.get('location')

        let session = null

        if (location && location.includes('#')) {
            const hash = location.split('#')[1]
            const params = new URLSearchParams(hash)
            
            if (params.get('access_token')) {
                session = {
                    access_token: params.get('access_token'),
                    refresh_token: params.get('refresh_token'),
                    expires_in: parseInt(params.get('expires_in') || '3600'),
                    token_type: params.get('token_type')
                }
            }
        }

        if (!session) {
            console.error('[AUTH] Failed to extract session from location:', location)
            // Fallback for legacy magic link
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Email verified successfully',
                    verified: true,
                    magic_link: actionLink
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log(`✅ Session acquired successfully for ${email}`)

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Email verified successfully',
                verified: true,
                session: session
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
