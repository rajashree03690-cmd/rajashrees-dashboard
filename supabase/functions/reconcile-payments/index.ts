import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Payment Reconciliation Edge Function
 * 
 * Safety net that runs every 10 min (via pg_cron) to catch
 * any payments captured on Razorpay but not reflected in the database.
 * 
 * Accepts optional body: { lookback_hours: number } (default: 96)
 */
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const rzpKeyId = Deno.env.get('RAZORPAY_KEY')
        const rzpKeySecret = Deno.env.get('RAZORPAY_SECRET')

        if (!rzpKeyId || !rzpKeySecret) {
            throw new Error('Razorpay credentials not configured (RAZORPAY_KEY / RAZORPAY_SECRET)')
        }

        const adminClient = createClient(supabaseUrl, supabaseServiceKey)
        const rzpAuth = btoa(`${rzpKeyId}:${rzpKeySecret}`)

        // Accept custom lookback hours from body, default to 96
        let lookbackHours = 96;
        try {
            const body = await req.json();
            if (body?.lookback_hours) lookbackHours = body.lookback_hours;
        } catch { /* no body or invalid JSON, use default */ }

        const cutoffDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

        const { data: suspectOrders, error: fetchError } = await adminClient
            .from('orders')
            .select('order_id, razorpay_order_id, payment_status, order_status, payment_transaction_id, created_at')
            .in('payment_status', ['failed', 'awaiting_payment', 'pending'])
            .not('razorpay_order_id', 'is', null)
            .is('razorpay_payment_id', null)
            .gte('created_at', cutoffDate)
            .order('created_at', { ascending: false })

        if (fetchError) {
            throw new Error(`Failed to fetch suspect orders: ${fetchError.message}`)
        }

        if (!suspectOrders || suspectOrders.length === 0) {
            console.log('✅ No suspect orders found — all clear')
            return new Response(JSON.stringify({
                success: true,
                message: 'No orders need reconciliation',
                checked: 0,
                fixed: 0,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log(`🔍 Found ${suspectOrders.length} suspect orders to check against Razorpay (lookback: ${lookbackHours}h)`)

        const results: any[] = []
        let fixedCount = 0

        for (const order of suspectOrders) {
            try {
                const rzpResponse = await fetch(
                    `https://api.razorpay.com/v1/orders/${order.razorpay_order_id}/payments`,
                    {
                        headers: {
                            'Authorization': `Basic ${rzpAuth}`,
                        },
                    }
                )

                if (!rzpResponse.ok) {
                    console.warn(`⚠️ Razorpay API error for ${order.order_id}: ${rzpResponse.status}`)
                    results.push({
                        order_id: order.order_id,
                        status: 'skipped',
                        reason: `Razorpay API returned ${rzpResponse.status}`,
                    })
                    continue
                }

                const rzpData = await rzpResponse.json()
                const payments = rzpData.items || []

                const capturedPayment = payments.find((p: any) => p.status === 'captured')

                if (capturedPayment) {
                    console.log(`🔧 RECONCILING: Order ${order.order_id} has captured payment ${capturedPayment.id} on Razorpay but is ${order.payment_status} in DB`)

                    const { error: updateError } = await adminClient
                        .from('orders')
                        .update({
                            payment_status: 'paid',
                            order_status: 'processing',
                            razorpay_payment_id: capturedPayment.id,
                            payment_transaction_id: capturedPayment.id,
                            transaction_id: capturedPayment.id,
                            updated_at: new Date().toISOString(),
                            order_note: 'RECONCILED: Payment auto-recovered by reconciliation job'
                        })
                        .eq('order_id', order.order_id)

                    if (updateError) {
                        console.error(`❌ Failed to reconcile ${order.order_id}:`, updateError.message)
                        results.push({ order_id: order.order_id, status: 'error', reason: updateError.message })
                    } else {
                        fixedCount++
                        console.log(`✅ FIXED: ${order.order_id} → paid (payment: ${capturedPayment.id}, ₹${capturedPayment.amount / 100})`)
                        results.push({
                            order_id: order.order_id,
                            status: 'fixed',
                            payment_id: capturedPayment.id,
                            amount: capturedPayment.amount / 100,
                        })
                    }
                } else {
                    results.push({
                        order_id: order.order_id,
                        status: 'confirmed_failed',
                        reason: 'No captured payment on Razorpay',
                    })
                }
            } catch (orderError: any) {
                console.error(`❌ Error processing ${order.order_id}:`, orderError.message)
                results.push({ order_id: order.order_id, status: 'error', reason: orderError.message })
            }
        }

        const summary = {
            success: true,
            timestamp: new Date().toISOString(),
            lookback_hours: lookbackHours,
            checked: suspectOrders.length,
            fixed: fixedCount,
            results,
        }

        console.log(`📊 Reconciliation complete: ${fixedCount}/${suspectOrders.length} orders fixed`)

        return new Response(JSON.stringify(summary), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('❌ Reconciliation error:', error.message)
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
