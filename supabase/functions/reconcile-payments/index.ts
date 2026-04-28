import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Payment Reconciliation Edge Function (v4)
 * 
 * Safety net that runs every 10 min (via pg_cron) to catch
 * any payments captured on Razorpay but not reflected in the database.
 * 
 * TWO-PASS RECONCILIATION:
 *   Pass 1: Check by razorpay_order_id stored in DB
 *   Pass 2: For orders still unfixed, search Razorpay orders by receipt (WB order ID)
 *           This catches RETRIED payments where Razorpay created a new order.
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

        console.log(`🔍 Found ${suspectOrders.length} suspect orders to check (lookback: ${lookbackHours}h)`)

        const results: any[] = []
        let fixedCount = 0

        for (const order of suspectOrders) {
            try {
                // ===== PASS 1: Check by razorpay_order_id stored in DB =====
                let capturedPayment: any = null
                let matchedRzpOrderId = order.razorpay_order_id

                const rzpResponse = await fetch(
                    `https://api.razorpay.com/v1/orders/${order.razorpay_order_id}/payments`,
                    {
                        headers: { 'Authorization': `Basic ${rzpAuth}` },
                    }
                )

                if (rzpResponse.ok) {
                    const rzpData = await rzpResponse.json()
                    const payments = rzpData.items || []
                    capturedPayment = payments.find((p: any) => p.status === 'captured')
                }

                // ===== PASS 2: If no captured payment found, search by receipt =====
                // This catches RETRIED payments where Razorpay created a new order
                if (!capturedPayment) {
                    console.log(`🔄 Pass 1 miss for ${order.order_id}. Trying receipt search...`)
                    
                    try {
                        // Search Razorpay orders by receipt (WB order ID)
                        const ordersSearchResponse = await fetch(
                            `https://api.razorpay.com/v1/orders?receipt=${order.order_id}&count=10`,
                            {
                                headers: { 'Authorization': `Basic ${rzpAuth}` },
                            }
                        )

                        if (ordersSearchResponse.ok) {
                            const ordersData = await ordersSearchResponse.json()
                            const rzpOrders = ordersData.items || []
                            
                            // Check each Razorpay order with matching receipt for a captured payment
                            for (const rzpOrder of rzpOrders) {
                                if (rzpOrder.id === order.razorpay_order_id) continue; // Already checked
                                
                                const retryResponse = await fetch(
                                    `https://api.razorpay.com/v1/orders/${rzpOrder.id}/payments`,
                                    {
                                        headers: { 'Authorization': `Basic ${rzpAuth}` },
                                    }
                                )

                                if (retryResponse.ok) {
                                    const retryData = await retryResponse.json()
                                    const retryPayments = retryData.items || []
                                    const found = retryPayments.find((p: any) => p.status === 'captured')
                                    
                                    if (found) {
                                        capturedPayment = found
                                        matchedRzpOrderId = rzpOrder.id
                                        console.log(`🎯 FOUND on retry order! ${order.order_id}: payment ${found.id} on RZP order ${rzpOrder.id}`)
                                        break
                                    }
                                }
                            }
                        }
                    } catch (searchError: any) {
                        console.warn(`⚠️ Receipt search failed for ${order.order_id}:`, searchError.message)
                    }
                }

                // ===== UPDATE DB if captured payment found =====
                if (capturedPayment) {
                    console.log(`🔧 RECONCILING: ${order.order_id} -> payment ${capturedPayment.id} (RZP order: ${matchedRzpOrderId})`)

                    const { error: updateError } = await adminClient
                        .from('orders')
                        .update({
                            payment_status: 'paid',
                            order_status: 'processing',
                            razorpay_order_id: matchedRzpOrderId,
                            razorpay_payment_id: capturedPayment.id,
                            payment_transaction_id: capturedPayment.id,
                            transaction_id: capturedPayment.id,
                            updated_at: new Date().toISOString(),
                            order_note: matchedRzpOrderId !== order.razorpay_order_id
                                ? 'RECONCILED: Payment recovered from retry Razorpay order'
                                : 'RECONCILED: Payment auto-recovered by reconciliation job'
                        })
                        .eq('order_id', order.order_id)

                    if (updateError) {
                        console.error(`❌ Failed to reconcile ${order.order_id}:`, updateError.message)
                        results.push({ order_id: order.order_id, status: 'error', reason: updateError.message })
                    } else {
                        fixedCount++
                        console.log(`✅ FIXED: ${order.order_id} → paid (₹${capturedPayment.amount / 100})`)
                        results.push({
                            order_id: order.order_id,
                            status: 'fixed',
                            payment_id: capturedPayment.id,
                            rzp_order_id: matchedRzpOrderId,
                            was_retry: matchedRzpOrderId !== order.razorpay_order_id,
                            amount: capturedPayment.amount / 100,
                        })
                    }
                } else {
                    results.push({
                        order_id: order.order_id,
                        status: 'confirmed_failed',
                        reason: 'No captured payment on Razorpay (checked original + retry orders)',
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
