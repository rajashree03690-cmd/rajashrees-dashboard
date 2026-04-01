import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Razorpay order creation via direct API (SDK doesn't work in Deno)

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
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const adminClient = createClient(supabaseUrl, supabaseServiceKey)

        // Parse request body first to check source
        const requestBody = await req.json()
        const { items, delivery_address, payment_method = 'COD', source, customer_id, customer_name, email, mobileNumber } = requestBody

        // 1. Handle authentication based on source
        let user: any = null
        let customerData: any = null

        // WhatsApp orders come with source='WhatsApp' and don't require user auth
        if (source === 'WhatsApp') {
            console.log('📱 Processing WhatsApp order...')

            // For WhatsApp, customer might be provided directly or we look up by customer_id
            if (customer_id) {
                const { data: existingCustomer } = await adminClient
                    .from('customers')
                    .select('customer_id, email, full_name, mobile_number')
                    .eq('customer_id', customer_id)
                    .single()

                customerData = existingCustomer
            }

            // If no customer found and we have customer details, use them
            if (!customerData) {
                customerData = {
                    customer_id: customer_id || null,
                    email: email || '',
                    full_name: customer_name || 'WhatsApp User',
                    mobile_number: mobileNumber || ''
                }
            }
        } else {
            // Web orders require authentication
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

            const supabase = createClient(supabaseUrl, supabaseAnonKey)
            const token = authHeader.replace('Bearer ', '')
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)

            if (authError || !authUser) {
                return new Response(JSON.stringify({
                    success: false,
                    message: 'Please login to place an order'
                }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                })
            }

            user = authUser

            // 2. Get OR Create customer (ROBUST SYNC for web users)
            // A. Try to find by Auth ID first (Best case)
            const { data: customerByAuth } = await adminClient
                .from('customers')
                .select('customer_id, email, full_name, mobile_number')
                .eq('auth_id', user.id)
                .single()

            if (customerByAuth) {
                customerData = customerByAuth
            } else {
                console.log('⚠️ Customer not found by Auth ID. Trying email fallback...')

                // B. Fallback: Find by Email
                const { data: customerByEmail } = await adminClient
                    .from('customers')
                    .select('customer_id, email, full_name, mobile_number, auth_id')
                    .eq('email', user.email)
                    .maybeSingle()

                if (customerByEmail) {
                    console.log('✅ Found customer by email. Linking Auth ID...')
                    // Link the found customer to this Auth User
                    await adminClient
                        .from('customers')
                        .update({ auth_id: user.id, updated_at: new Date() })
                        .eq('customer_id', customerByEmail.customer_id)

                    customerData = customerByEmail
                } else {
                    console.log('⚠️ No customer found. Creating new record...')
                    // C. Create New Customer
                    const { data: newCustomer, error: createError } = await adminClient
                        .from('customers')
                        .insert({
                            auth_id: user.id,
                            email: user.email,
                            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
                            mobile_number: user.phone || null,
                            source: 'web' // Match schema constraint
                        })
                        .select()
                        .single()

                    if (createError) {
                        console.error('❌ Failed to create customer:', createError)
                        throw new Error('Failed to create customer profile')
                    }
                    customerData = newCustomer
                }
            }
        }

        const customer = customerData

        // 3. Validate request body
        if (!items || !delivery_address) {
            return new Response(JSON.stringify({
                success: false,
                error: 'items and delivery_address required'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 4. SECURE PRICE VERIFICATION
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

            // Strict stock validation: NULL or 0 = out of stock
            const availableStock = variant.stock ?? 0

            // Block order if stock is NULL, 0, or insufficient
            if (availableStock === 0) {
                throw new Error(`${variant.variant_name} is currently out of stock. Please remove it from your cart or try again later.`)
            }

            if (availableStock < item.quantity) {
                throw new Error(`Insufficient stock for ${variant.variant_name}. Only ${availableStock} available, but you requested ${item.quantity}.`)
            }

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

        // 4b. Validate: order total must be greater than zero
        if (subtotal <= 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Order total cannot be zero. Please check item prices.'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 5. Calculate shipping based on new pricing structure
        const calculateShipping = (state: string): number => {
            const normalizedState = state?.toLowerCase().replace(/\s/g, '') || ''

            // Tamil Nadu: ₹85
            if (normalizedState === 'tamilnadu') {
                return 85
            }

            // South India: ₹100 (AP, Telangana, Karnataka, Kerala)
            const southIndiaStates = ['andhrapradesh', 'telangana', 'karnataka', 'kerala']
            if (southIndiaStates.includes(normalizedState)) {
                return 100
            }

            // Rest of India: ₹130
            return 130
        }

        const shipping_fee = calculateShipping(delivery_address.state)
        const total_amount = subtotal + shipping_fee

        // Helper function to format phone with country code (91, not +91)
        const formatPhoneWithCountryCode = (phone: string, country: string = 'India'): string => {
            if (!phone) return '';

            // Clean the phone (remove spaces, dashes, +, etc.)
            const cleanPhone = phone.replace(/[^0-9]/g, '');

            // If already starts with 91, return as is
            if (cleanPhone.startsWith('91')) return cleanPhone;

            // Get country code based on country (no + sign)
            const countryCode = country === 'India' ? '91' : '91'; // Default to India

            return `${countryCode}${cleanPhone}`;
        }

        // Generate short order ID: WB######
        const randomNum = Math.floor(100000 + Math.random() * 900000)
        const order_id = `WB${randomNum}`

        console.log('📦 Order Details:', {
            order_id,
            customer_id: customer.customer_id,
            subtotal,
            shipping_fee,
            total_amount,
            state: delivery_address.state
        })

        // 6. Create Razorpay order FIRST (if online payment)
        let razorpayOrder = null

        if (payment_method === 'RAZORPAY_ONLINE' || payment_method === 'UPI' || payment_method === 'CREDIT_CARD' || payment_method === 'DEBIT_CARD') {
            const rzpKeyId = Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('RAZORPAY_KEY')
            const rzpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || Deno.env.get('RAZORPAY_SECRET')

            if (!rzpKeyId || !rzpKeySecret) {
                throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase secrets.')
            }

            try {
                const auth = btoa(`${rzpKeyId}:${rzpKeySecret}`)
                const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        amount: Math.round(total_amount * 100), // Convert to paise
                        currency: 'INR',
                        receipt: order_id,
                        notes: {
                            customer_id: String(customer.customer_id),
                            order_id: order_id,
                            customer_email: customer.email || ''
                        }
                    })
                })

                if (!rzpResponse.ok) {
                    const errorText = await rzpResponse.text()
                    console.error('❌ Razorpay API error:', rzpResponse.status, errorText)
                    throw new Error(`Razorpay API error: ${errorText}`)
                }

                razorpayOrder = await rzpResponse.json()
                console.log('✅ Razorpay order created:', razorpayOrder.id)
            } catch (error: any) {
                console.error('❌ Razorpay order creation failed:', error)
                throw new Error(`Payment gateway error: ${error.message}`)
            }
        }

        // All orders are online payments (NO COD)
        const isOnlinePayment = true

        // 7. Create Order in database
        const orderInsertPayload: any = {
            order_id: order_id,
            customer_id: customer.customer_id,
            total_amount: total_amount,
            shipping_amount: shipping_fee,
            payment_method: payment_method,
            payment_status: 'awaiting_payment',
            order_status: 'pending_payment',
            shipping_address: delivery_address.address,
            shipping_state: delivery_address.state,
            shipping_pincode: delivery_address.pincode,
            contact_number: formatPhoneWithCountryCode(delivery_address.mobile, delivery_address.country),
            name: delivery_address.full_name,
            source: source || 'WEB',  // Use source from request (WhatsApp or WEB)
            razorpay_order_id: razorpayOrder ? razorpayOrder.id : null
        }

        // Only add auth_id for web orders (WhatsApp orders don't have auth)
        if (user?.id) {
            orderInsertPayload.auth_id = user.id
        }

        const { data: order, error: oError } = await adminClient
            .from('orders')
            .insert(orderInsertPayload)
            .select()
            .single()

        if (oError) {
            console.error('❌ Order creation failed:', oError);
            console.error('📦 Order data attempted:', {
                order_id,
                customer_id: customer.customer_id,
                delivery_address,
                total_amount
            });
            throw new Error(`Order creation failed: ${oError.message}. Details: ${oError.details || 'None'}`);
        }

        console.log('✅ Order created:', order.order_id)

        // 8. Create Order Items
        const orderItemsPayload = verifiedItems.map((item: any, index: number) => ({
            order_item_id: `${order.order_id}-${index + 1}-${Math.floor(Math.random() * 1000)}`,
            order_id: order.order_id,
            catalogue_product_id: item.variant_id,
            quantity: item.quantity,
            is_combo: false
        }))

        const { error: oiError } = await adminClient
            .from('order_items')
            .insert(orderItemsPayload)

        if (oiError) {
            console.error('❌ Order items creation error:', oiError)
            throw oiError
        }

        console.log('✅ Order items created')

        // 8b. Log Order Event: Order Placed
        try {
            await adminClient.from('order_events').insert({
                order_id: order.order_id,
                event_type: 'order_placed',
                description: `Order placed with ${verifiedItems.length} item(s) for ₹${total_amount}`,
                metadata: {
                    total_amount,
                    item_count: verifiedItems.length,
                    source: source || 'WEB',
                    payment_method,
                },
                created_by: source === 'WhatsApp' ? 'system' : 'customer',
            })
        } catch (eventError) {
            console.warn('⚠️ order_events insert failed (non-critical):', eventError)
        }

        // 9. All order confirmation emails and cart clearing will be handled
        // by the razorpay-webhook Edge Function AFTER successful payment.
        console.log('⏳ Order created in pending state — waiting for payment webhook to send email and clear cart')

        // 10. Cart clearing is now handled by razorpay-verify EF AFTER payment is confirmed
        // (Previously cleared here before payment, which was incorrect)

        // 11. Return response with Razorpay details if applicable
        const responseData: any = {
            order_id: order.order_id,
            order_number: order.order_id,  // For compatibility
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
                    key: Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('RAZORPAY_KEY'),
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
                        color: "#E9507C"
                    }
                }
            }
        }

        console.log('✅ Order creation completed successfully')

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
        console.error('❌ ORDERS-CREATE ERROR:', error);

        // Safely extract error message without risking cyclic JSON.stringify crashes
        const safeErrorMessage = error?.message || String(error);
        const safeErrorHint = error?.hint || '';
        const safeErrorDetails = error?.details ? String(error.details) : '';

        return new Response(JSON.stringify({
            success: false,
            message: `Order creation failed: ${safeErrorMessage}`,
            error: safeErrorMessage,
            hint: safeErrorHint,
            details: safeErrorDetails
        }), {
            status: safeErrorMessage === 'Unauthorized' ? 401 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
