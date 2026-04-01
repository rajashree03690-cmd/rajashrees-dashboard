import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { order_ids } = body;

        if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
            return NextResponse.json(
                { error: 'Missing or invalid order_ids' },
                { status: 400 }
            );
        }

        console.log(`[Bulk Invoice API] Starting generation for ${order_ids.length} orders`);

        const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generateInvoicePDFV2`;

        // Process in batches to avoid overwhelming the Edge Function
        const BATCH_SIZE = 5;
        const results = [];

        for (let i = 0; i < order_ids.length; i += BATCH_SIZE) {
            const batch = order_ids.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(batch.map(async (id: string) => {
                try {
                    const response = await fetch(edgeFunctionUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
                        },
                        body: JSON.stringify({ order_id: id })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        return { order_id: id, success: false, error: errorData.error };
                    }

                    const result = await response.json();
                    return { order_id: id, ...result };
                } catch (error: any) {
                    return { order_id: id, success: false, error: error.message };
                }
            }));
            results.push(...batchResults);
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: true,
            total: order_ids.length,
            successful: successCount,
            failed: failedCount,
            results
        });

    } catch (error: any) {
        console.error('[Bulk Invoice API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
