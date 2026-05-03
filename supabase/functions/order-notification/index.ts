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
 * Design: Gold/Cherry color scheme matching rajashreefashions.com
 * Input: { type, order_id, tracking_id?, carrier?, refund_amount?, refund_id? }
 * Types: order_received, invoice_generated, order_dispatched, order_delivered, refund_initiated
 */

// Logo URL (public hosted)
const LOGO_URL = 'https://www.rajashreefashions.com/logo.jpg?v=2'
const SITE_URL = 'https://rajashreefashions.com'

// â”€â”€â”€ HTML Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function baseTemplate(title: string, content: string, footerNote?: string) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Georgia', 'Noto Serif', serif; line-height: 1.7; color: #4d4635; margin: 0; padding: 0; background: #f5f0e3; }
  .outer { max-width: 640px; margin: 0 auto; padding: 24px; }
  .wrapper { background: #ffffff; border-radius: 16px; overflow: hidden; border: 2px solid #d4af37; box-shadow: 0 8px 32px rgba(115, 92, 0, 0.12); }
  
  /* Header with gold gradient */
  .header { 
    background: linear-gradient(135deg, #735c00 0%, #d4af37 50%, #8b7a2e 100%); 
    padding: 32px 40px; 
    text-align: center; 
    position: relative;
    overflow: hidden;
  }
  /* Logo watermark in header */
  .header::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 180px;
    height: 180px;
    background: url('${LOGO_URL}') center/contain no-repeat;
    opacity: 0.08;
  }
  .header-logo { width: 60px; height: 60px; border-radius: 12px; background: #fff; padding: 4px; display: inline-block; margin-bottom: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
  .header-logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; }
  .header h1 { color: #ffffff; font-size: 26px; margin: 0; letter-spacing: 3px; font-weight: 400; font-style: italic; position: relative; z-index: 1; text-shadow: 0 2px 4px rgba(0,0,0,0.2); }
  .header .subtitle { color: #fff8e1; font-size: 11px; letter-spacing: 5px; text-transform: uppercase; margin-top: 6px; position: relative; z-index: 1; font-family: Arial, sans-serif; }
  
  /* Gold decorative border below header */
  .gold-border { height: 4px; background: linear-gradient(90deg, transparent, #d4af37, #735c00, #d4af37, transparent); }
  
  /* Content area with subtle logo watermark */
  .content { 
    padding: 40px; 
    position: relative;
    background: #ffffff;
  }
  .content::after {
    content: '';
    position: absolute;
    bottom: 20px;
    right: 20px;
    width: 120px;
    height: 120px;
    background: url('${LOGO_URL}') center/contain no-repeat;
    opacity: 0.04;
  }
  
  .title { font-size: 22px; font-weight: 700; color: #735c00; margin-bottom: 8px; font-style: italic; }
  
  /* Status badges */
  .status-badge { display: inline-block; padding: 6px 18px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; font-family: Arial, sans-serif; }
  .badge-green { background: linear-gradient(135deg, #e8f5e9, #c8e6c9); color: #2e7d32; border: 1px solid #a5d6a7; }
  .badge-gold { background: linear-gradient(135deg, #fff8e1, #ffecb3); color: #735c00; border: 1px solid #d4af37; }
  .badge-cherry { background: linear-gradient(135deg, #fce4ec, #f8bbd0); color: #af2b3e; border: 1px solid #ef9a9a; }
  .badge-blue { background: linear-gradient(135deg, #e3f2fd, #bbdefb); color: #1565c0; border: 1px solid #90caf9; }
  .badge-orange { background: linear-gradient(135deg, #fff3e0, #ffe0b2); color: #e65100; border: 1px solid #ffcc80; }
  
  /* Decorative divider */
  .divider { height: 1px; background: linear-gradient(90deg, transparent, #d4af37, transparent); margin: 28px 0; }
  
  /* Items table */
  .items-table { width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #f0ead6; border-radius: 8px; overflow: hidden; }
  .items-table th { background: linear-gradient(135deg, #faf7f0, #f5f0e3); padding: 12px 14px; text-align: left; font-size: 11px; color: #735c00; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #d4af37; font-family: Arial, sans-serif; }
  .items-table td { padding: 14px; border-bottom: 1px solid #f5f0e3; font-size: 14px; color: #4d4635; }
  .items-table tr:last-child td { border-bottom: none; }
  .items-table .sku { font-size: 11px; color: #8b7a2e; font-family: monospace; margin-top: 2px; }
  .total-row td { font-weight: 700; font-size: 16px; border-top: 2px solid #d4af37; padding-top: 16px; color: #735c00; }
  
  /* Info box with gold accent */
  .info-box { background: linear-gradient(135deg, #faf7f0, #f5f0e3); border-left: 4px solid #d4af37; padding: 18px 22px; margin: 20px 0; border-radius: 0 12px 12px 0; border: 1px solid #f0ead6; border-left: 4px solid #d4af37; }
  
  /* Tracking box */
  .tracking-box { background: linear-gradient(135deg, #faf7f0, #fff8e1); border: 2px dashed #d4af37; padding: 24px; text-align: center; margin: 24px 0; border-radius: 12px; }
  .tracking-id { font-size: 24px; font-weight: 700; color: #735c00; letter-spacing: 4px; font-family: monospace; }
  
  /* CTA Button */
  .btn { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #735c00, #d4af37); color: #ffffff; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 14px; letter-spacing: 1px; font-family: Arial, sans-serif; box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3); }
  .btn-cherry { background: linear-gradient(135deg, #af2b3e, #d4365e); box-shadow: 0 4px 12px rgba(175, 43, 62, 0.3); }
  
  /* Address block */
  .address-block { background: #faf7f0; padding: 18px; border-radius: 12px; margin: 16px 0; border: 1px solid #f0ead6; }
  
  /* Footer */
  .footer { 
    background: linear-gradient(135deg, #1c1c18, #2a2520); 
    padding: 28px 40px; 
    text-align: center; 
    font-size: 12px; 
    color: #a09880; 
    font-family: Arial, sans-serif;
    position: relative;
  }
  .footer::before {
    content: '';
    display: block;
    height: 3px;
    background: linear-gradient(90deg, #735c00, #d4af37, #735c00);
    margin: -28px -40px 20px;
  }
  .footer a { color: #d4af37; text-decoration: none; font-weight: 600; }
  .footer-logo { width: 32px; height: 32px; border-radius: 8px; margin-bottom: 12px; opacity: 0.6; }
  
  /* Highlight text */
  .gold-text { color: #d4af37; }
  .cherry-text { color: #af2b3e; }
  .bold { font-weight: 700; }
</style>
</head>
<body>
<div class="outer">
<div class="wrapper">
  <div class="header">
    <div class="header-logo"><img src="${LOGO_URL}" alt="RF" /></div>
    <h1>Rajashree Fashion</h1>
    <div class="subtitle">Premium Imitation Jewellery</div>
  </div>
  <div class="gold-border"></div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <img src="${LOGO_URL}" alt="RF" class="footer-logo" />
    ${footerNote ? `<p style="margin-bottom:14px;color:#c8b590;font-style:italic;">${footerNote}</p>` : ''}
    <p>Need help? Contact us at <a href="mailto:support@rajashreefashion.com">support@rajashreefashion.com</a></p>
    <p style="margin-top:8px;">
      <a href="${SITE_URL}" style="color:#d4af37;">Visit Our Store</a> &nbsp;•&nbsp; 
      <a href="${SITE_URL}/orders" style="color:#d4af37;">Track Orders</a> &nbsp;•&nbsp; 
      <a href="${SITE_URL}/contact" style="color:#d4af37;">Contact Us</a>
    </p>
    <p style="margin-top:16px;color:#665f50;">&copy; ${new Date().getFullYear()} Rajashree Fashion. All rights reserved.</p>
  </div>
</div>
</div>
</body>
</html>`
}

function formatCurrency(amount: number) {
    return `&#x20B9;${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function itemsTableHtml(items: any[]) {
    const rows = items.map(item => `
    <tr>
      <td>
        <strong>${item.variant_name || item.product_name || 'Item'}</strong>
        ${item.sku ? `<div class="sku">SKU: ${item.sku}</div>` : ''}
      </td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatCurrency(item.price || item.saleprice || 0)}</td>
      <td style="text-align:right"><strong>${formatCurrency((item.price || item.saleprice || 0) * item.quantity)}</strong></td>
    </tr>`).join('')

    return `
    <table class="items-table">
      <thead>
        <tr>
          <th>Product</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Price</th>
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

// â”€â”€â”€ Email Builders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function orderReceivedEmail(order: any, items: any[]) {
    const content = `
    <p class="title">Order Confirmed! 🎉</p>
    <span class="status-badge badge-green">✓ Payment Successful</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>Thank you for choosing Rajashree Fashion! We've received your payment and your order is now being processed with care.</p>
    
    <div class="info-box">
      <strong style="color:#735c00;font-size:16px;">Order #${order.order_id}</strong><br>
      <span style="color:#8b7a2e;">Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span><br>
      <span style="color:#2e7d32;font-weight:700;">Payment: ${order.payment_method || 'Prepaid'} ✅</span>
    </div>
    
    ${itemsTableHtml(items)}
    
    <table style="width:100%;margin-top:12px;font-size:14px;">
      <tr><td style="color:#8b7a2e;">Subtotal</td><td style="text-align:right;color:#4d4635;">${formatCurrency(order.total_amount - (order.shipping_amount || 0))}</td></tr>
      <tr><td style="color:#8b7a2e;">Shipping</td><td style="text-align:right;color:#4d4635;">${formatCurrency(order.shipping_amount || 0)}</td></tr>
      <tr class="total-row"><td style="border-top:2px solid #d4af37;padding-top:12px;font-weight:700;color:#735c00;">Total Paid</td><td style="text-align:right;border-top:2px solid #d4af37;padding-top:12px;font-weight:700;color:#2e7d32;font-size:18px;">${formatCurrency(order.total_amount)}</td></tr>
    </table>
    
    <div class="address-block">
      <strong style="color:#735c00;">📦 Shipping to:</strong><br>
      ${order.name}<br>
      ${order.shipping_address}<br>
      ${order.shipping_state || ''}<br>
      📞 ${order.contact_number || ''}
    </div>
    
    <div style="background:linear-gradient(135deg,#fff8e1,#faf7f0);border:1px solid #f0ead6;border-radius:12px;padding:18px;margin-top:20px;text-align:center;">
      <p style="margin:0;color:#735c00;font-weight:600;">🕒 Your order will be processed and shipped within <strong>8-10 business days</strong>.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8b7a2e;">We'll send you updates at every step!</p>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/orders" class="btn">View Your Orders</a>
    </div>
    `
    return {
        subject: `Order Confirmed ✨ #${order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Order Confirmed', content)
    }
}

function invoiceGeneratedEmail(order: any, items: any[]) {
    const content = `
    <p class="title">Invoice Generated 📄</p>
    <span class="status-badge badge-gold">Invoice Ready</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>Great news! Your order has been confirmed and the invoice has been generated. Your order will be shipped within <strong>8-10 business days</strong>.</p>
    
    <div class="info-box">
      <strong style="color:#735c00;font-size:16px;">Order #${order.order_id}</strong><br>
      ${order.invoice_number ? `<span style="color:#8b7a2e;">Invoice: <strong>${order.invoice_number}</strong></span><br>` : ''}
      <span style="color:#735c00;">Amount: <strong>${formatCurrency(order.total_amount)}</strong></span>
    </div>
    
    ${itemsTableHtml(items)}
    
    ${order.invoice_url ? `
    <div style="text-align:center;margin:28px 0;">
      <a href="${order.invoice_url}" class="btn" target="_blank">📥 Download Invoice</a>
    </div>
    ` : ''}
    
    <div style="background:linear-gradient(135deg,#fff8e1,#faf7f0);border:1px solid #f0ead6;border-radius:12px;padding:18px;text-align:center;">
      <p style="margin:0;color:#735c00;font-weight:600;">📦 We're preparing your order for shipment.</p>
      <p style="margin:8px 0 0;font-size:13px;color:#8b7a2e;">You'll receive a tracking notification once it's dispatched.</p>
    </div>
    `
    return {
        subject: `Invoice Ready 📄 #${order.invoice_number || order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Invoice Generated', content, 'Your order will be shipped within 8-10 business days.')
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
    <span class="status-badge badge-cherry">✦ Shipped</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>Wonderful! Your order has been dispatched and is on its way to you!</p>
    
    <div class="info-box">
      <strong style="color:#735c00;font-size:16px;">Order #${order.order_id}</strong><br>
      <span style="color:#8b7a2e;">Carrier: <strong>${carrierName}</strong></span>
    </div>
    
    ${trackingId ? `
    <div class="tracking-box">
      <p style="margin:0 0 8px;font-size:11px;color:#8b7a2e;letter-spacing:3px;text-transform:uppercase;font-family:Arial,sans-serif;">Tracking ID</p>
      <div class="tracking-id">${trackingId}</div>
      ${trackingLink ? `<p style="margin:16px 0 0"><a href="${trackingLink}" class="btn btn-cherry" target="_blank">Track Your Shipment</a></p>` : ''}
    </div>
    ` : ''}

    ${itemsTableHtml(items)}
    
    <div class="address-block">
      <strong style="color:#735c00;">📦 Delivering to:</strong><br>
      ${order.name}<br>
      ${order.shipping_address}<br>
      ${order.shipping_state || ''}
    </div>
    
    <div style="background:linear-gradient(135deg,#fce4ec,#fff0f3);border:1px solid #f8bbd0;border-radius:12px;padding:18px;text-align:center;margin-top:20px;">
      <p style="margin:0;color:#af2b3e;font-weight:600;">Estimated delivery: <strong>3-5 business days</strong> from dispatch date.</p>
    </div>
    `
    return {
        subject: `Order Shipped 🚚 #${order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Order Shipped', content)
    }
}

function orderDeliveredEmail(order: any, items: any[]) {
    const content = `
    <p class="title">Order Delivered! ✅</p>
    <span class="status-badge badge-green">✓ Delivered</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>Your order has been delivered successfully. We hope you love your new jewellery!</p>
    
    <div class="info-box">
      <strong style="color:#735c00;font-size:16px;">Order #${order.order_id}</strong><br>
      <span style="color:#8b7a2e;">Delivered on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span><br>
      <span style="color:#735c00;">Amount: ${formatCurrency(order.total_amount)}</span>
    </div>
    
    ${itemsTableHtml(items)}
    
    <div style="background:linear-gradient(135deg,#fff8e1,#faf7f0);border:2px solid #d4af37;border-radius:16px;padding:24px;margin:24px 0;text-align:center;">
      <p style="margin:0;font-size:18px;font-weight:600;color:#735c00;">💛 Enjoy your Rajashree Fashion purchase!</p>
      <p style="margin:10px 0 0;font-size:13px;color:#8b7a2e;">If you have any concerns, please contact us within 7 days of delivery.</p>
      <div style="margin-top:16px;">
        <a href="${SITE_URL}/shop" class="btn">Shop More ✨</a>
      </div>
    </div>
    `
    return {
        subject: `Order Delivered ✅ #${order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Order Delivered', content, 'Thank you for shopping with Rajashree Fashion!')
    }
}

function refundInitiatedEmail(order: any, refundAmount: number, refundId?: string) {
    const content = `
    <p class="title">Refund Initiated -</p>
    <span class="status-badge badge-orange">Refund Processing</span>
    <div class="divider"></div>
    
    <p>Dear <strong>${order.name || 'Customer'}</strong>,</p>
    <p>We've initiated a refund for your order. The amount will be credited back to your original payment method.</p>
    
    <div class="info-box">
      <strong style="color:#735c00;font-size:16px;">Order #${order.order_id}</strong><br>
      <span style="color:#2e7d32;font-size:18px;font-weight:700;">Refund Amount: ${formatCurrency(refundAmount)}</span><br>
      ${refundId ? `<span style="color:#8b7a2e;">Refund ID: <code style="background:#f5f0e3;padding:2px 8px;border-radius:4px;">${refundId}</code></span><br>` : ''}
      <span style="color:#e65100;font-weight:600;">Status: Processing</span>
    </div>
    
    <div style="background:linear-gradient(135deg,#fff8e1,#faf7f0);border:2px solid #d4af37;border-radius:12px;padding:20px;margin:24px 0;">
      <p style="margin:0;font-weight:700;color:#735c00;font-size:16px;">Refund Timeline</p>
      <div style="background:#fff;border-radius:8px;padding:16px;margin-top:12px;border:1px solid #f0ead6;">
        <table style="width:100%;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#8b7a2e;">UPI / Wallets</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#4d4635;">2-3 business days</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8b7a2e;">Debit / Credit Card</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#4d4635;">5-7 business days</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#8b7a2e;">Net Banking</td>
            <td style="padding:6px 0;text-align:right;font-weight:600;color:#4d4635;">5-7 business days</td>
          </tr>
        </table>
      </div>
    </div>
    
    <p style="color:#8b7a2e;font-size:14px;">If you don't receive the refund within 7 business days, please contact our support team with your Refund ID.</p>
    
    <div style="text-align:center;margin-top:20px;">
      <a href="mailto:support@rajashreefashion.com" class="btn">Contact Support</a>
    </div>
    `
    return {
        subject: `Refund Initiated - Order #${order.order_id} | Rajashree Fashion`,
        html: baseTemplate('Refund Initiated', content)
    }
}

// â”€â”€â”€ Main Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            console.log(`âš ï¸ No email found for order ${order_id}, skipping notification`)
            return new Response(JSON.stringify({
                success: false,
                error: 'No customer email found'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // Fetch order items with SKU
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
                console.log(`â³ Rate-limit retry ${attempt}/3, waiting ${attempt * 1500}ms...`)
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

            if (emailResponse.ok) break // Success â€” exit retry loop

            if (emailResponse.status === 429) {
                console.warn(`âš ï¸ Resend 429 rate limit hit (attempt ${attempt + 1}/3)`)
                continue // Retry after delay
            }

            // Non-rate-limit error â€” don't retry
            console.error('âŒ Resend error:', emailResult)
            throw new Error(emailResult.message || 'Email send failed')
        }

        if (!emailResponse?.ok) {
            console.error('âŒ Resend rate limit exhausted after 3 retries')
            // Return success:false but DON'T throw â€” prevents worker starvation
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
        console.error('âŒ Order notification error:', error)
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Failed to send notification',
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
