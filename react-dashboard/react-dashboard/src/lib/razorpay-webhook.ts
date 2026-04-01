import crypto from 'crypto';

export function verifyRazorpaySignature(
    body: string,
    signature: string,
    secret: string
): boolean {
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
    );
}

export interface RazorpayRefundWebhookPayload {
    event: 'refund.created' | 'refund.processed' | 'refund.failed';
    payload: {
        refund: {
            entity: {
                id: string;
                payment_id: string;
                amount: number;
                status: string;
                notes?: {
                    order_id?: string;
                };
            };
        };
    };
}

export function parseRefundPayload(payload: RazorpayRefundWebhookPayload) {
    const refund = payload.payload.refund.entity;

    return {
        razorpay_refund_id: refund.id,
        razorpay_payment_id: refund.payment_id,
        refund_amount: refund.amount / 100,
        refund_status: mapRefundStatus(refund.status),
        order_id: refund.notes?.order_id,
    };
}

function mapRefundStatus(razorpayStatus: string): 'created' | 'processed' | 'failed' {
    switch (razorpayStatus.toLowerCase()) {
        case 'created':
        case 'pending':
            return 'created';
        case 'processed':
        case 'successful':
            return 'processed';
        case 'failed':
            return 'failed';
        default:
            return 'created';
    }
}
