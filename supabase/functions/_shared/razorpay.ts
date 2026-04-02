/**
 * Razorpay Integration for Deno Edge Functions
 * 
 * Since the npm Razorpay SDK doesn't work in Deno, we use direct API calls
 */

interface RazorpayOrderOptions {
    amount: number  // in paise (₹1 = 100 paise)
    currency: string
    receipt: string
    notes?: Record<string, string>
}

interface RazorpayOrder {
    id: string
    entity: string
    amount: number
    amount_paid: number
    amount_due: number
    currency: string
    receipt: string
    status: string
    attempts: number
    notes: Record<string, string>
    created_at: number
}

export async function createRazorpayOrder(options: RazorpayOrderOptions): Promise<RazorpayOrder> {
    const keyId = Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('RAZORPAY_KEY')
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || Deno.env.get('RAZORPAY_SECRET')

    if (!keyId || !keySecret) {
        throw new Error('Razorpay credentials not configured')
    }

    // Create basic auth header
    const auth = btoa(`${keyId}:${keySecret}`)

    const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(options)
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Razorpay API error: ${error}`)
    }

    return await response.json()
}

export async function verifyRazorpayPayment(
    orderId: string,
    paymentId: string,
    signature: string
): Promise<boolean> {
    const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || Deno.env.get('RAZORPAY_SECRET')
    if (!keySecret) {
        throw new Error('Razorpay secret not configured')
    }

    // Create signature hash
    const encoder = new TextEncoder()
    const data = encoder.encode(`${orderId}|${paymentId}`)
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

    return expectedSignature === signature
}

export function getRazorpayCheckoutOptions(order: RazorpayOrder, customerDetails: {
    name?: string
    email?: string
    contact?: string
}) {
    return {
        key: Deno.env.get('RAZORPAY_KEY_ID') || Deno.env.get('RAZORPAY_KEY'),
        amount: order.amount,
        currency: order.currency,
        name: 'Rajashree Fashion',
        description: `Order ${order.receipt}`,
        order_id: order.id,
        prefill: {
            name: customerDetails.name || '',
            email: customerDetails.email || '',
            contact: customerDetails.contact || ''
        },
        theme: {
            color: '#9333ea'  // Purple theme
        }
    }
}
