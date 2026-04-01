import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Razorpay from "https://esm.sh/razorpay@2.9.2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Validate user authentication
        const authHeader = req.headers.get('authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Please login to place an order'
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: authError } = await supabase.auth.getUser(token)

        if (authError || !user) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Please login to place an order'
            }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Get customer
        const { data: customer, error: custError } = await adminClient
            .from('customers')
            .select('customer_id, email, full_name, mobile_number')
            .eq('auth_id', user.id)
            .single()

        if (custError || !customer) {
            throw new Error('Customer not found')
        }

        // 3. Parse and validate request body
        const { items, delivery_address, payment_method = 'COD' } = await req.json()

        if (!items || !delivery_address) {
            return new Response(JSON.stringify({
                success: false,
                error: 'items and delivery_address required'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. SECURE PRICE VERIFICATION
        const variantIds = items.map((item: any) => item.variant_id)
        const { data: dbVariants, error: dvError } = await adminClient
            .from('product_variants')
            .select('variant_id, saleprice, variant_name, stock')
            .in('variant_id', variantIds)

        if (dvError || !dbVariants) throw new Error('Failed to verify products')

        let subtotal = 0
        const verifiedItems = items.map((item: any) => {
            const variant = dbVariants.find(v => v.variant_id === item.variant_id)
            if (!variant) throw new Error(`Product variant ${item.variant_id} not found`)
            if (variant.stock < item.quantity) throw new Error(`Insufficient stock for ${variant.variant_name}`)

            const itemSubtotal = Number(variant.saleprice) * item.quantity
            subtotal += itemSubtotal

            return {
                variant_id: item.variant_id,
                product_title: variant.variant_name,
                price: variant.saleprice,
                quantity: item.quantity,
                subtotal: itemSubtotal
            }
        })

        // 3. Calculate totals
        const shipping_fee = delivery_address.state?.toLowerCase().replace(/\s/g, '') === 'tamilnadu' ? 50 : 85
        const total_amount = subtotal + shipping_fee

        // Generate short order ID: WB######
        const randomNum = Math.floor(100000 + Math.random() * 900000)
        const order_id = `WB${randomNum}`

        // 4. Create Razorpay order FIRST (if online payment)
        let razorpayOrder = null

        if (payment_method === 'RAZORPAY_ONLINE' || payment_method === 'UPI') {
            try {
                const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID')
                const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET')

                if (rzpKeyId && rzpKeySecret) {
                    const razorpay = new Razorpay({
                        key_id: rzpKeyId,
                        key_secret: rzpKeySecret,
                    })

                    razorpayOrder = await razorpay.orders.create({
                        amount: Math.round(total_amount * 100), // Convert to paise
                        currency: 'INR',
                        receipt: order_id,
                        notes: {
                            customer_id: String(customer.customer_id),
                            order_id: order_id,
                            customer_email: customer.email || ''
                        }
                    })
                }
            } catch (error: any) {
                console.error('Razorpay order creation failed:', error)
                throw new Error(`Payment gateway error: ${error.message}`)
            }
        }

        // 5. Create Order in database
        const { data: order, error: oError } = await adminClient
            .from('orders')
            .insert({
                order_id: order_id,
                customer_id: customer.customer_id,
                auth_id: user.id,
                total_amount: total_amount,
                shipping_amount: shipping_fee,  // Column is called shipping_amount
                payment_method: payment_method,
                payment_status: payment_method === 'COD' ? 'pending' : 'awaiting_payment',
                order_status: 'processing',  // Default to processing for invoice generation
                shipping_address: delivery_address.address,  // TEXT field, not JSONB
                shipping_state: delivery_address.state,
                shipping_pincode: delivery_address.pincode,
                contact_number: delivery_address.mobile,
                name: delivery_address.full_name,
                source: 'WEB'
            })
            .select()
            .single()

        if (oError) throw oError

        // 6. Create Order Items
        const orderItemsPayload = verifiedItems.map((item: any) => ({
            order_id: order.order_id,
            catalogue_product_id: item.variant_id,  // Uses catalogue_product_id
            quantity: item.quantity,
            is_combo: false
        }))

        const { error: oiError } = await adminClient
            .from('order_items')
            .insert(orderItemsPayload)

        if (oiError) throw oiError

        // 7. Clear cart if authenticated user
        if (user) {
            const { data: cart } = await adminClient
                .from('cart')
                .select('cart_id')
                .eq('customer_id', customer.customer_id)
                .eq('status', 'active')
                .single()

            if (cart) {
                await adminClient
                    .from('cart_item')
                    .delete()
                    .eq('cart_id', cart.cart_id)
            }
        }

        // 8. Send order confirmation email
        try {
            const resendApiKey = Deno.env.get('RESEND_API_KEY')
            if (resendApiKey && customer.email) {
                const emailBody = {
                    from: 'Rajashree Fashion <noreply@rajashreefashion.com>',
                    to: customer.email,
                    subject: `Order Confirmation - ${order.order_id}`,
                    html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #9333ea 0%, #db2777 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; }
        .order-info { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .item { padding: 15px 0; border-bottom: 1px solid #e5e7eb; }
        .total-row { display: flex; justify-content: space-between; padding: 10px 0; }
        .total-row.final { font-weight: bold; font-size: 18px; border-top: 2px solid #e5e7eb; padding-top: 15px; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin: 0;">Rajashree Fashion</h1>
        <p style="margin: 10px 0 0 0;">Thank you for your order!</p>
    </div>
    <div class="content">
        <div class="order-info">
            <h2 style="margin-top: 0; color: #9333ea;">Order Confirmed</h2>
            <p>Hi ${customer.full_name || delivery_address.full_name},</p>
            <p>Your order has been confirmed and will be processed soon.</p>
            <p><strong>Order ID:</strong> ${order.order_id}</p>
            <p><strong>Payment Method:</strong> ${payment_method === 'COD' ? 'Cash on Delivery' : payment_method}</p>
        </div>
        <div class="order-info">
            <h3 style="margin-top: 0;">Order Items</h3>
            ${verifiedItems.map((item: any) => `
                <div class="item">
                    <strong>${item.product_title}</strong><br>
                    Qty: ${item.quantity} × ₹${item.price} = <strong>₹${item.subtotal.toFixed(2)}</strong>
                </div>
            `).join('')}
            <div style="margin-top: 20px;">
                <div class="total-row"><span>Subtotal:</span><span>₹${(total_amount - shipping_fee).toFixed(2)}</span></div>
                <div class="total-row"><span>Shipping:</span><span>₹${shipping_fee.toFixed(2)}</span></div>
                <div class="total-row final"><span>Total:</span><span>₹${total_amount.toFixed(2)}</span></div>
            </div>
        </div>
        <div class="order-info">
            <h3 style="margin-top: 0;">Shipping Address</h3>
            <p>${delivery_address.full_name}<br>${delivery_address.address}<br>${delivery_address.city}, ${delivery_address.state} - ${delivery_address.pincode}<br>${delivery_address.mobile}</p>
        </div>
    </div>
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px;">
        <p>&copy; ${new Date().getFullYear()} Rajashree Fashion. All rights reserved.</p>
    </div>
</body>
</html>
                    `
                }

                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${resendApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(emailBody)
                })
            }
        } catch (emailError) {
            console.error('Email sending failed (non-critical):', emailError)
            // Don't fail order creation if email fails
        }

        // 9. Return response with Razorpay details if applicable
        const responseData: any = {
            order_id: order.order_id,
            total: order.total_amount,
            payment_method: payment_method
        }

        // Add Razorpay details for online payment
        if (razorpayOrder) {
            responseData.razorpay = {
                order_id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                checkout_options: {
                    key: Deno.env.get('RAZORPAY_KEY_ID'),
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                    order_id: razorpayOrder.id,
                    name: "Rajashree Fashion",
                    description: `Order #${order.order_id}`,
                    prefill: {
                        name: customer.full_name || delivery_address.full_name,
                        email: customer.email || delivery_address.email,
                        contact: customer.mobile_number || delivery_address.mobile
                    },
                    theme: {
                        color: "#7C3AED"
                    }
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            message: payment_method === 'COD'
                ? 'Order created successfully'
                : 'Order created. Please complete payment.',
            data: responseData
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        console.error('Order creation error:', error)
        return new Response(JSON.stringify({
            success: false,
            message: error.message,
            data: null
        }), {
            status: error.message === 'Unauthorized' ? 401 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
