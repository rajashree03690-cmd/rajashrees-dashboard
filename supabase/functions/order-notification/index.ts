import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Order Notification Edge Function
 * 
 * Sends branded HTML emails for order lifecycle events.
 * Input: { type, order_id, tracking_id?, carrier? }
 * Types: order_received, invoice_generated, order_dispatched, order_delivered, refund_initiated
 */

// ─── HTML Templates ───────────────────────────────────────────────

function baseTemplate(title: string, content: string, footerNote?: string) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
  .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px 40px; text-align: center; }
  .header h1 { color: #ffffff; font-size: 24px; margin: 0; letter-spacing: 2px; font-weight: 300; }
  .header .subtitle { color: #e2c8a0; font-size: 13px; letter-spacing: 4px; text-transform: uppercase; margin-top: 4px; }
  .content { padding: 40px; }
  .title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 8px; }
  .status-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  .badge-green { background: #e8f5e9; color: #2e7d32; }
  .badge-blue { background: #e3f2fd; color: #1565c0; }
  .badge-purple { background: #f3e5f5; color: #7b1fa2; }
  .badge-orange { background: #fff3e0; color: #e65100; }
  .divider { height: 1px; background: #eee; margin: 24px 0; }
  .items-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .items-table th { background: #f8f9fa; padding: 10px 12px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eee; }
  .items-table td { padding: 12px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #1a1a2e; padding-top: 16px; }
  .info-box { background: #f8f9fa; border-left: 4px solid #1a1a2e; padding: 16px 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }
  .tracking-box { background: #e3f2fd; border: 2px dashed #1565c0; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
  .tracking-id { font-size: 24px; font-weight: 700; color: #1565c0; letter-spacing: 3px; font-family: monospace; }
  .btn { display: inline-block; padding: 12px 32px; background: #1a1a2e; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
  .footer { background: #f8f9fa; padding: 24px 40px; text-align: center; font-size: 12px; color: #999; }
  .footer a { color: #1a1a2e; text-decoration: none; }
  .address-block { background: #fafafa; padding: 16px; border-radius: 8px; margin: 12px 0; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Rajashree Fashion</h1>
    <div class="subtitle">Premium Indian Fashion</div>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    ${footerNote ? `<p style="margin-bottom:12px;color:#666;">${footerNote}</p>` : ''}
    <p>Need help? Contact us at <a href="mailto:support@rajashreefashion.com">support@rajashreefashion.com</a></p>
    <p>&copy; ${new Date().getFullYear()} Rajashree Fashion. All rights reserved.</p>
  </div>
</div>
</body>
</html>`
}

function formatCurrency(amount: number) {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function itemsTableHtml(items: any[]) {
    const rows = items.map(item => `
    <tr>
      <td>${item.variant_name || item.product_name || 'Item'}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatCurrency(item.price || item.saleprice || 0)}</td>
      <td style="text-align:right">${formatCurrency((item.price || item.saleprice || 0) * item.quantity)}</td>
    </tr>`).join('')

    return `
    <table class="items-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

// ─── Email Builders ───────────────────────────────────────────────

function orderReceivedEmail(order: any, items: any[]) {
    const content = `
    <p class="title">Order Confirmed! 🎉</p>
    <span class="status-badge badge-green">Payment Successful</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>Thank you for your order! We've received your payment and your order is now being processed.</p>
    
    <div class="info-box">
      <strong>Order #${order.order_id}</strong><br>
      Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
      Payment: ${order.payment_method || 'Prepaid'} ✅
    </div>
    
    ${itemsTableHtml(items)}
    
    <table style="width:100%;margin-top:8px;">
      <tr><td>Subtotal</td><td style="text-align:right">${formatCurrency(order.total_amount - (order.shipping_amount || 0))}</td></tr>
      <tr><td>Shipping</td><td style="text-align:right">${formatCurrency(order.shipping_amount || 0)}</td></tr>
      <tr class="total-row"><td>Total Paid</td><td style="text-align:right;color:#2e7d32">${formatCurrency(order.total_amount)}</td></tr>
    </table>
    
    <div class="address-block">
      <strong>📦 Shipping to:</strong><br>
      ${order.name}<br>
      ${order.shipping_address}<br>
      ${order.shipping_state || ''}<br>
      📞 ${order.contact_number || ''}
    </div>
    
    <p style="color:#666;font-size:14px;">Your order will be processed and shipped within <strong>4-5 business days</strong>. We'll send you updates at every step!</p>
    `
    return {
        subject: `Order Confirmed - #${order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Order Confirmed', content)
    }
}

function invoiceGeneratedEmail(order: any, items: any[]) {
    const content = `
    <p class="title">Invoice Generated 📄</p>
    <span class="status-badge badge-blue">Invoice Ready</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>Great news! Your order has been confirmed and the invoice has been generated. Your order will be shipped within <strong>4-5 business days</strong>.</p>
    
    <div class="info-box">
      <strong>Order #${order.order_id}</strong><br>
      ${order.invoice_number ? `Invoice: ${order.invoice_number}<br>` : ''}
      Amount: <strong>${formatCurrency(order.total_amount)}</strong>
    </div>
    
    ${itemsTableHtml(items)}
    
    ${order.invoice_url ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${order.invoice_url}" class="btn" target="_blank">📥 Download Invoice</a>
    </div>
    ` : ''}
    
    <p style="color:#666;font-size:14px;">We're preparing your order for shipment. You'll receive a tracking notification once it's dispatched.</p>
    `
    return {
        subject: `Invoice Ready - #${order.invoice_number || order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Invoice Generated', content, 'Your order will be shipped within 4-5 business days.')
    }
}

function orderDispatchedEmail(order: any, items: any[], trackingId?: string, carrier?: string) {
    const carrierName = carrier || 'Our Delivery Partner'
    let trackingLink = ''
    if (trackingId) {
        if (carrier?.toLowerCase().includes('delhivery')) {
            trackingLink = `https://www.delhivery.com/track/package/${trackingId}`
        } else if (carrier?.toLowerCase().includes('india post')) {
            trackingLink = `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx`
        }
    }

    const content = `
    <p class="title">Your Order is On Its Way! 🚚</p>
    <span class="status-badge badge-purple">Shipped</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>Your order has been dispatched and is on its way to you!</p>
    
    <div class="info-box">
      <strong>Order #${order.order_id}</strong><br>
      Carrier: <strong>${carrierName}</strong>
    </div>
    
    ${trackingId ? `
    <div class="tracking-box">
      <p style="margin:0 0 8px;font-size:13px;color:#666;">TRACKING ID</p>
      <div class="tracking-id">${trackingId}</div>
      ${trackingLink ? `<p style="margin:12px 0 0"><a href="${trackingLink}" class="btn" target="_blank">🔍 Track Your Shipment</a></p>` : ''}
    </div>
    ` : ''}
    
    <div class="address-block">
      <strong>📦 Delivering to:</strong><br>
      ${order.name}<br>
      ${order.shipping_address}<br>
      ${order.shipping_state || ''}
    </div>
    
    <p style="color:#666;font-size:14px;">Estimated delivery: <strong>3-5 business days</strong> from dispatch date.</p>
    `
    return {
        subject: `Order Shipped - #${order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Order Shipped', content)
    }
}

function orderDeliveredEmail(order: any, items: any[]) {
    const content = `
    <p class="title">Order Delivered! ✅</p>
    <span class="status-badge badge-green">Delivered</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>Your order has been delivered successfully. We hope you love your purchase!</p>
    
    <div class="info-box">
      <strong>Order #${order.order_id}</strong><br>
      Delivered on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}<br>
      Amount: ${formatCurrency(order.total_amount)}
    </div>
    
    ${itemsTableHtml(items)}
    
    <div style="background:#fff8e1;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
      <p style="margin:0;font-weight:600;color:#f57f17;">💛 Enjoy your Rajashree Fashion purchase!</p>
      <p style="margin:8px 0 0;font-size:13px;color:#666;">If you have any concerns about your order, please contact us within 7 days of delivery.</p>
    </div>
    `
    return {
        subject: `Order Delivered - #${order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Order Delivered', content, 'Thank you for shopping with Rajashree Fashion!')
    }
}

function refundInitiatedEmail(order: any, refundAmount: number, refundId?: string) {
    const content = `
    <p class="title">Refund Initiated 💰</p>
    <span class="status-badge badge-orange">Refund Processing</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>We've initiated a refund for your order. The amount will be credited back to your original payment method.</p>
    
    <div class="info-box">
      <strong>Order #${order.order_id}</strong><br>
      Refund Amount: <strong style="color:#2e7d32">${formatCurrency(refundAmount)}</strong><br>
      ${refundId ? `Refund ID: ${refundId}<br>` : ''}
      Status: <strong>Processing</strong>
    </div>
    
    <div style="background:#e3f2fd;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-weight:600;color:#1565c0;">⏱️ Refund Timeline</p>
      <p style="margin:8px 0 0;font-size:14px;color:#333;">
        The refund will reflect in your account within <strong>5-7 business days</strong> depending on your bank/payment provider.
      </p>
    </div>
    
    <p style="color:#666;font-size:14px;">If you don't receive the refund within 7 business days, please contact our support team.</p>
    `
    return {
        subject: `Refund Initiated - Order #${order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Refund Initiated', content)
    }
}

// ─── Main Handler ─────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { type, order_id, tracking_id, carrier, refund_amount, refund_id } = await req.json()

        if (!type || !order_id) {
            return new Response(JSON.stringify({ error: 'type and order_id are required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Init Supabase admin
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        // Fetch order with customer info
        const { data: order, error: orderError } = await adminClient
            .from('orders')
            .select(`
                *,
                customers (
                    customer_id,
                    full_name,
                    email,
                    mobile_number
                )
            `)
            .eq('order_id', order_id)
            .single()

        if (orderError || !order) {
            throw new Error(`Order not found: ${orderError?.message || 'No data'}`)
        }

        // Get customer email
        const customerEmail = order.customers?.email
        if (!customerEmail) {
            console.log(`⚠️ No email found for order ${order_id}, skipping notification`)
            return new Response(JSON.stringify({
                success: false,
                error: 'No customer email found'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Fetch order items
        const { data: orderItems } = await adminClient
            .from('order_items')
            .select(`
                *,
                product_variants (
                    sku,
                    variant_name,
                    saleprice
                )
            `)
            .eq('order_id', order_id)

        const items = (orderItems || []).map(item => ({
            variant_name: item.product_variants?.variant_name || 'Product',
            quantity: item.quantity,
            price: item.product_variants?.saleprice || 0,
            sku: item.product_variants?.sku || ''
        }))

        // Build email based on type
        let emailData: { subject: string; html: string }

        switch (type) {
            case 'order_received':
                emailData = orderReceivedEmail(order, items)
                break
            case 'invoice_generated':
                emailData = invoiceGeneratedEmail(order, items)
                break
            case 'order_dispatched':
                emailData = orderDispatchedEmail(order, items, tracking_id, carrier)
                break
            case 'order_delivered':
                emailData = orderDeliveredEmail(order, items)
                break
            case 'refund_initiated':
            case 'refund_completed':
                emailData = refundInitiatedEmail(order, refund_amount || order.total_amount, refund_id)
                break
            default:
                throw new Error(`Unknown notification type: ${type}`)
        }

        // Send via Resend (with Free Tier rate-limit protection: max 1 email/sec)
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
        if (!RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY not configured')
        }

        // Rate-limit guard: retry up to 3 times with 1.5s delay on 429
        let emailResult: any = null
        let emailResponse: Response | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) {
                console.log(`⏳ Rate-limit retry ${attempt}/3, waiting ${attempt * 1500}ms...`)
                await new Promise(r => setTimeout(r, attempt * 1500))
            }

            emailResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: 'Rajashree Fashion <noreply@rajashreefashion.com>',
                    to: [customerEmail],
                    reply_to: 'support@rajashreefashion.com',
                    subject: emailData.subject,
                    html: emailData.html,
                }),
            })

            emailResult = await emailResponse.json()

            if (emailResponse.ok) break // Success — exit retry loop

            if (emailResponse.status === 429) {
                console.warn(`⚠️ Resend 429 rate limit hit (attempt ${attempt + 1}/3)`)
                continue // Retry after delay
            }

            // Non-rate-limit error — don't retry
            console.error('❌ Resend error:', emailResult)
            throw new Error(emailResult.message || 'Email send failed')
        }

        if (!emailResponse?.ok) {
            console.error('❌ Resend rate limit exhausted after 3 retries')
            // Return success:false but DON'T throw — prevents worker starvation
            return new Response(JSON.stringify({
                success: false,
                error: 'Rate limited by email provider, will retry later',
                type,
            }), {
                status: 200, // Return 200 to prevent upstream retries
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        console.log(`✅ ${type} email sent to ${customerEmail} for order ${order_id} - ID: ${emailResult.id}`)

        return new Response(JSON.stringify({
            success: true,
            type,
            email_sent_to: customerEmail,
            resend_id: emailResult.id,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('❌ Order notification error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Failed to send notification',
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
