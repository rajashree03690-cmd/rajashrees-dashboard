
import { serve } "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const orderIdPath = url.pathname.split('/').pop() // might be 'orders-track' if not using REST path style
        // We expect ?order_id=XYZ via query param as per typical Supabase function usage, 
        // OR a POST body. The previous mock used POST body. User prompt says GET /api/orders/{orderId}/tracking
        // But edge functions are usually POST or mapped. Let's support both query param or body.

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // 1. Get Order ID
        let orderId = url.searchParams.get('order_id')
        if (!orderId) {
            try {
                const body = await req.json()
                orderId = body.order_id
            } catch (e) {
                // ignore
            }
        }

        if (!orderId) {
            return new Response(JSON.stringify({ error: 'Order ID is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // 2. Fetch Tracking Info from DB
        const { data: tracker, error: dbError } = await supabase
            .from('shipment_tracking')
            .select('*')
            .eq('order_id', orderId)
            .maybeSingle()

        if (dbError) throw dbError
        if (!tracker) {
            return new Response(JSON.stringify({ error: 'No tracking information found for this order' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const { tracking_number, shipping_provider } = tracker

        // --- 3. LOGIC: FETCH LIVE STATUS ---

        let normalizedStatus = tracker.shipping_status || 'PENDING'
        let timeline = []
        let lastLocation = tracker.last_location || ''
        let rawResponse = null
        let fetchSuccess = false

        // A. Primary: Delhivery
        if (shipping_provider === 'Delhivery' || shipping_provider === 'DELHIVERY' || !shipping_provider) {
            const token = Deno.env.get('DELHIVERY_API_TOKEN')
            if (token && tracking_number) {
                try {
                    const response = await fetch(`https://staging-express.delhivery.com/api/v1/packages/json/?waybill=${tracking_number}`, {
                        headers: { 'Authorization': `Token ${token}` }
                    })

                    if (response.ok) {
                        const data = await response.json()
                        if (data.ShipmentData && data.ShipmentData[0]) {
                            const shipData = data.ShipmentData[0]
                            const details = shipData.Shipment

                            // Normalize Status
                            // Map Delhivery status to internal: ORDER_PLACED, SCANNED, IN_TRANSIT, DELIVERED, RTO, etc.
                            const dStatus = details.Status?.Status
                            if (dStatus === 'Delivered') normalizedStatus = 'DELIVERED'
                            else if (dStatus === 'In Transit') normalizedStatus = 'IN_TRANSIT'
                            else if (dStatus === 'Manifested') normalizedStatus = 'ORDER_PLACED'
                            else if (dStatus === 'Dispatched') normalizedStatus = 'SHIPPED'
                            else normalizedStatus = dStatus || normalizedStatus

                            // Timeline
                            if (details.Scans) {
                                timeline = details.Scans.map((scan: any) => ({
                                    date: scan.ScanDetail?.ScanDateTime,
                                    status: scan.ScanDetail?.ScanType,
                                    location: scan.ScanDetail?.ScannedLocation
                                }))
                                const latestScan = timeline[timeline.length - 1]
                                if (latestScan) lastLocation = latestScan.location
                            }

                            rawResponse = data
                            fetchSuccess = true
                        }
                    }
                } catch (err) {
                    console.error('Delhivery API Error:', err)
                }
            }
        }

        // B. Secondary: India Post (Failover)
        if (!fetchSuccess && (shipping_provider === 'India Post' || !fetchSuccess)) { // Fallback if Delhivery failed or it IS India Post
            // NOTE: India Post public API is not standard.
            // Provided placeholder logic as per prompt "India Post tracking endpoint or API" (User did not provide credentials).
            // Implementing fallback structure.

            if (tracking_number) {
                // Mock/Scrape logic would go here.
                // For now, we return what is in DB or mock a "Tracking Unavailable" if it's a real failover.
                // If the DB has status, we assume it's valid if we can't fetch new info.
                console.log('Using India Post Fallback (Logic Placeholder)')
            }
        }

        // --- 4. UPDATE DB with Fresh Info ---
        if (fetchSuccess) {
            await supabase
                .from('shipment_tracking')
                .update({
                    shipping_status: normalizedStatus,
                    last_location: lastLocation,
                    last_synced_at: new Date().toISOString(),
                    raw_response: rawResponse
                })
                .eq('order_id', orderId)
        }

        // --- 5. Return Normalized Response ---
        const responseData = {
            orderId: orderId,
            awb: tracking_number,
            courier: shipping_provider,
            currentStatus: normalizedStatus,
            lastUpdated: new Date().toISOString(),
            lastLocation: lastLocation,
            timeline: timeline.length > 0 ? timeline : [
                // Fallback timeline if empty
                { status: 'Order Placed', date: tracker.created_at, location: 'Store' },
                { status: tracker.shipping_status, date: tracker.updated_at, location: lastLocation }
            ]
        }

        return new Response(JSON.stringify(responseData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
