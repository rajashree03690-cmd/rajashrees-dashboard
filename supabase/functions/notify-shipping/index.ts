import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const resendApiKey = Deno.env.get('RESEND_API_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 1. Parse the Webhook Payload
        // Supabase webhooks send the 'record' (new row) and 'old_record'
        const { record } = await req.json()

        if (!record || !record.order_id) {
            throw new Error('Invalid webhook payload')
        }

        // 2. Fetch Order and Customer details for the email
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
                order_id,
                name,
                total_amount,
                customers (
                    email,
                    full_name
                )
            `)
            .eq('order_id', record.order_id)
            .single()

        if (orderError || !order) {
            throw new Error(`Failed to fetch order details: ${orderError?.message}`)
        }

        const customerEmail = (order.customers as any)?.email
        const customerName = (order.customers as any)?.full_name || order.name

        if (!customerEmail) {
            console.log(`⚠️ No email found for order ${order.order_id}. Skipping notification.`);
            return new Response(JSON.stringify({ success: true, message: 'No email found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 3. Send Dispatch Email via Resend
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h1 style="color: #E91E63; text-align: center;">Order Dispatched! 🚚</h1>
                <p>Hi ${customerName},</p>
                <p>Great news! Your order <strong>#${order.order_id}</strong> has been dispatched and is on its way to you.</p>
                
                <div style="background: #fdf2f8; border: 2px solid #fce7f3; border-radius: 16px; padding: 25px; margin: 30px 0; text-align: center;">
                    <h2 style="margin-top: 0; color: #E91E63;">Tracking Information</h2>
                    <p style="font-size: 18px; margin-bottom: 5px;"><strong>Courier:</strong> ${record.shipping_provider}</p>
                    <p style="font-size: 18px; margin-bottom: 20px;"><strong>Tracking ID:</strong> ${record.tracking_number}</p>
                    
                    <a href="${record.tracking_url || `https://rajashreefashion.com/track-order?id=${order.order_id}`}" 
                       style="background: #E91E63; color: white; text-decoration: none; padding: 15px 30px; rounded-radius: 50px; font-weight: bold; display: inline-block;">
                        Track My Order
                    </a>
                </div>

                <p>You can also download your official invoice from your account dashboard once it's processed.</p>
                <p>Thank you for shopping with Rajashree Fashion!</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="text-align: center; color: #999; font-size: 12px;">
                    © ${new Date().getFullYear()} Rajashree Fashion. All rights reserved.
                </p>
            </div>
        `

        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Rajashree Fashion <noreply@rajashreefashion.com>',
                to: customerEmail,
                subject: `Order Dispatched: #${order.order_id}`,
                html: emailHtml
            })
        })

        if (!res.ok) {
            const error = await res.text()
            throw new Error(`Resend API Error: ${error}`)
        }

        return new Response(JSON.stringify({ success: true, message: 'Notification sent' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('❌ Notification Error:', error.message)
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
