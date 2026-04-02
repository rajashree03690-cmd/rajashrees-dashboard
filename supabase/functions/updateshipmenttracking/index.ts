import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, GET, OPTIONS,PUT,PATCH",
                "Access-Control-Allow-Headers": "*",
            },
        });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- 1. Get order_id + inline param ---
    const url = new URL(req.url);
    const orderId = url.searchParams.get("order_id");
    const inlineMode = url.searchParams.get("inline");
    const isInline = inlineMode === "true";

    if (!orderId) {
        return new Response(JSON.stringify({ error: "Missing order_id" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    // --- 2. Parse body ---
    let body;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    const { tracking_number, shipping_provider, shipping_cost } = body;
    if (!tracking_number) {
        return new Response(JSON.stringify({ error: "Missing tracking_number" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    }

    // --- 3. Deduce provider ---
    let trackingUrl = "";
    if (shipping_provider === "DTDC") {
        trackingUrl = `https://www.dtdc.in/tracking.asp?cnno=${tracking_number}`;
    } else if (shipping_provider === "Franch Express") {
        trackingUrl = `https://franchexpress.com/track/${tracking_number}`;
    } else if (shipping_provider === "India Post") {
        trackingUrl = `https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignmentno=${tracking_number}`;
    } else if (shipping_provider === "Delhivery" || shipping_provider === "delhivery") {
        trackingUrl = `https://www.delhivery.com/track/package/${tracking_number}`;
    }

    // --- 4. Build update data ---
    const today = new Date().toISOString().split("T")[0];
    const updateData: Record<string, any> = {
        tracking_number,
        shipping_provider: shipping_provider,
        tracking_url: trackingUrl,
        shipping_status: "Shipped",
        shipped_date: today,
        updated_at: new Date().toISOString(),
    };
    // Include shipping_cost if provided (admin's cost paid to provider)
    if (shipping_cost !== undefined && shipping_cost !== null) {
        updateData.shipping_cost = Number(shipping_cost) || 0;
    }

    try {
        // (a) Update shipment_tracking
        // We cannot use upsert with onConflict='order_id' because order_id is not a unique constraint in the DB.
        // Instead, we check if it exists, then update or insert.

        const { data: existingShipment, error: fetchErr } = await supabase
            .from("shipment_tracking")
            .select("shipment_id")
            .eq("order_id", orderId)
            .maybeSingle();

        if (fetchErr) throw fetchErr;

        let shipmentId;
        let data;

        if (existingShipment) {
            // UPDATE
            const { data: updated, error: updateErr } = await supabase
                .from("shipment_tracking")
                .update(updateData)
                .eq("shipment_id", existingShipment.shipment_id)
                .select("shipment_id, order_id")
                .single();

            if (updateErr) throw updateErr;
            shipmentId = updated.shipment_id;
            data = updated;
        } else {
            // INSERT
            const { data: inserted, error: insertErr } = await supabase
                .from("shipment_tracking")
                .insert({ ...updateData, order_id: orderId })
                .select("shipment_id, order_id")
                .single();

            if (insertErr) throw insertErr;
            shipmentId = inserted.shipment_id;
            data = inserted;
        }

        // (b) If NOT inlineMode → handle stock updates
        if (!isInline) {
            const { data: items, error: itemsErr } = await supabase
                .from("order_items")
                .select("catalogue_product_id, quantity")
                .eq("order_id", orderId);

            if (itemsErr) throw itemsErr;

            for (const item of items) {
                const variantId = item.catalogue_product_id;
                const qty = item.quantity;

                // Call stored procedure
                const { error } = await supabase.rpc("decrement_stock", {
                    p_variant_id: variantId,
                    p_quantity: qty,
                });
                if (error) throw error;

                // Insert into stock ledger
                const { error: ledgerErr } = await supabase
                    .from("stock_ledger")
                    .insert({
                        variant_id: variantId,
                        change_type: "OUT",
                        reference_type: "shipment",
                        reference_id: String(shipmentId),
                        quantity: qty,
                        note: `Order ${orderId} shipped (shipment ${shipmentId})`,
                        created_at: new Date().toISOString(),
                    });
                if (ledgerErr) throw ledgerErr;
            }
        }
        // (c) Update order status to Completed
        const { error: orderStatusErr } = await supabase
            .from("orders")
            .update({
                order_status: "shipped", // Using 'shipped' to match DB (was 'Completed' in user snippet but standard is usually lowercase or matches enum)
                updated_at: new Date().toISOString()
            })
            .eq("order_id", orderId);

        if (orderStatusErr) throw orderStatusErr;
        return new Response(
            JSON.stringify({
                message: inlineMode
                    ? "Shipment updated (no stock change, inline mode)"
                    : "Shipment + stock updated successfully",
                shipment_id: shipmentId,
                order_id: orderId,
                ...updateData,
            }),
            { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
    } catch (err: any) {
        console.error("❌ Transaction failed:", err.message);

        // rollback shipment changes (Best effort)
        await supabase
            .from("shipment_tracking")
            .update({
                tracking_number: null,
                shipping_provider: null,
                tracking_url: null,
                shipping_status: "pending",
                shipped_date: null,
            })
            .eq("order_id", orderId);

        return new Response(
            JSON.stringify({ error: "Transaction failed, rolled back", details: err.message }),
            { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
    }
});
