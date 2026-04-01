
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Inlined CORS headers for Dashboard compatibility
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Payments-Verify Edge Function
 * Inlined logic to support Supabase Dashboard Deployment
 */
serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { order_id, razorpay_payment_id, razorpay_order_id, razorpay_signature } = await req.json()

        if (!order_id || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return new Response(JSON.stringify({ error: 'Missing payment details' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 1. Verify Razorpay Signature (Inlined for Dashboard Deployment)
        const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET')
        if (!keySecret) {
            throw new Error('Razorpay secret not configured')
        }

        const encoder = new TextEncoder()
        const data = encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`)
        const keyData = encoder.encode(keySecret)

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        )

        const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data)
        const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')

        const isValid = expectedSignature === razorpay_signature

        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Update Order Status - MATCHING YOUR SCHEMA CONSTRAINTS
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        const { error } = await adminClient
            .from('orders')
            .update({
                order_status: 'confirmed',                   // Must be lowercase for CHECK constraint
                payment_status: 'paid',                      // Must be lowercase for CHECK constraint
                payment_transaction_id: razorpay_payment_id, // Exact matches column name in your SQL
                updated_at: new Date().toISOString()
            })
            .eq('order_id', order_id)

        if (error) {
            console.error('Database Update Error:', error)
            throw new Error(`Failed to update order: ${error.message}`)
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Payment verified successfully'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Payment verification error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
