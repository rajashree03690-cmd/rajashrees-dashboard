import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            },
        });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id");

    try {
        let query = supabase
            .from("orders")
            .select(`
        order_id,
        customer_id,
        order_status,
        created_at,
        shipment_tracking (
          shipment_id,
          tracking_number,
          shipping_provider,
          tracking_url,
          shipping_status,
          shipped_date
        )
        
      `);

        if (orderId) {
            query = query.ilike("order_id", orderId).single();
        }

        const { data, error } = await query;

        if (error) throw error;

        return new Response(JSON.stringify({ orders: data }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (err) {
        console.error("❌ Fetch error:", err.message);
        return new Response(
            JSON.stringify({ error: "Failed to fetch orders", details: err.message }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    }
});
