import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { order_id } = body;

        if (!order_id) {
            return NextResponse.json(
                { error: 'Missing order_id' },
                { status: 400 }
            );
        }

        console.log(`[Invoice API] Generating invoice via Edge Function for order: ${order_id}`);

        // Call the Edge Function
        const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generateInvoicePDFV2`;

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ order_id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Edge Function failed');
        }

        const result = await response.json();

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || 'Failed to generate invoice' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            invoice_url: result.invoice_url,
            order_id
        });

    } catch (error: any) {
        console.error('[Invoice API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
