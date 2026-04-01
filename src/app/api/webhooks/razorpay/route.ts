import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    verifyRazorpaySignature,
    parseRefundPayload,
    RazorpayRefundWebhookPayload,
} from '@/lib/razorpay-webhook';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const signature = req.headers.get('x-razorpay-signature');

        if (!signature) {
            console.error('[Razorpay Webhook] Missing signature');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const rawBody = await req.text();

        const isValid = verifyRazorpaySignature(
            rawBody,
            signature,
            process.env.RAZORPAY_WEBHOOK_SECRET!
        );

        if (!isValid) {
            console.error('[Razorpay Webhook] Invalid signature');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload: RazorpayRefundWebhookPayload = JSON.parse(rawBody);

        if (!['refund.created', 'refund.processed', 'refund.failed'].includes(payload.event)) {
            console.log(`[Razorpay Webhook] Ignoring event: ${payload.event}`);
            return NextResponse.json({ received: true }, { status: 200 });
        }

        const refundData = parseRefundPayload(payload);

        if (!refundData.order_id) {
            console.error('[Razorpay Webhook] Missing order_id in refund notes', {
                refund_id: refundData.razorpay_refund_id,
            });
            return NextResponse.json({ received: true }, { status: 200 });
        }

        const { error } = await supabase
            .from('order_refunds')
            .upsert(
                {
                    order_id: refundData.order_id,
                    razorpay_payment_id: refundData.razorpay_payment_id,
                    razorpay_refund_id: refundData.razorpay_refund_id,
                    refund_amount: refundData.refund_amount,
                    refund_status: refundData.refund_status,
                    is_partial: true,
                    initiated_by: 'razorpay_webhook',
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'razorpay_refund_id',
                }
            );

        if (error) {
            console.error('[Razorpay Webhook] Supabase error:', error);
            return NextResponse.json({ received: true }, { status: 200 });
        }

        console.log(`[Razorpay Webhook] Successfully processed ${payload.event}`, {
            refund_id: refundData.razorpay_refund_id,
            order_id: refundData.order_id,
            status: refundData.refund_status,
        });

        return NextResponse.json({ received: true }, { status: 200 });
    } catch (error) {
        console.error('[Razorpay Webhook] Unhandled error:', error);
        return NextResponse.json({ received: true }, { status: 200 });
    }
}

export const runtime = 'nodejs';
