import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    // CORS Headers
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*", // Allow all headers
    };

    if (req.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const headerComboId = req.headers.get("combo-id");
        const body = await req.json();
        const { combo_id: bodyComboId, name, description, saleprice, regularprice, sku, image_url, items, combo_quantity, subcategory_id } = body;

        const comboId = headerComboId ? parseInt(headerComboId) : bodyComboId;

        if (!comboId || isNaN(comboId)) {
            return new Response(
                JSON.stringify({ error: "Missing valid combo_id" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!Array.isArray(items)) {
            return new Response(
                JSON.stringify({ error: "Invalid items array" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 1. Update Combo
        const updatePayload: any = {
            name,
            description,
            saleprice,
            regularprice,
            sku,
            image_url: image_url || null,
            updated_at: new Date().toISOString()
        };

        if (combo_quantity !== undefined) {
            updatePayload.combo_quantity = Number(combo_quantity);
        }

        if (subcategory_id !== undefined) {
            updatePayload.subcategory_id = subcategory_id;
        }

        const { error: updateErr } = await supabase
            .from("combo")
            .update(updatePayload)
            .eq("combo_id", comboId);

        if (updateErr) throw new Error(`Failed to update combo: ${updateErr.message}`);

        // 2. Sync Items (Fetch Existing -> Diff -> Insert/Update/Delete)
        const { data: existingItems, error: fetchErr } = await supabase
            .from("combo_items")
            .select("combo_item_id, variant_id, quantity_per_combo")
            .eq("combo_id", comboId);

        if (fetchErr) throw new Error(`Failed to fetch existing items: ${fetchErr.message}`);

        const existingMap = new Map(existingItems.map(i => [Number(i.variant_id), i]));
        const requestItemMap = new Map(items.map((i: any) => [Number(i.variant_id), i]));

        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        // Identify Inserts and Updates
        for (const item of items) {
            const vid = Number(item.variant_id);
            if (existingMap.has(vid)) {
                const existing = existingMap.get(vid);
                if (existing.quantity_per_combo !== item.quantity_per_combo) {
                    toUpdate.push({
                        combo_item_id: existing.combo_item_id,
                        quantity_per_combo: item.quantity_per_combo
                    });
                }
            } else {
                toInsert.push(item);
            }
        }

        // Identify Deletes
        const toDelete = existingItems.filter(i => !requestItemMap.has(Number(i.variant_id)));

        // Execute Deletes
        if (toDelete.length > 0) {
            const { error: delErr } = await supabase
                .from("combo_items")
                .delete()
                .in("combo_item_id", toDelete.map(i => i.combo_item_id));
            if (delErr) throw new Error(`Failed to delete items: ${delErr.message}`);
        }

        // Execute Updates
        for (const item of toUpdate) {
            const { error: upErr } = await supabase
                .from("combo_items")
                .update({ quantity_per_combo: item.quantity_per_combo })
                .eq("combo_item_id", item.combo_item_id);
            if (upErr) throw new Error(`Failed to update item ${item.combo_item_id}: ${upErr.message}`);
        }

        // Execute Inserts (Let DB generate combo_item_id)
        if (toInsert.length > 0) {
            const newItems = toInsert.map((item: any) => ({
                combo_id: comboId,
                variant_id: item.variant_id,
                quantity_per_combo: item.quantity_per_combo
            }));

            const { error: insErr } = await supabase.from("combo_items").insert(newItems);
            if (insErr) throw new Error(`Failed to insert new items: ${insErr.message}`);
        }

        return new Response(
            JSON.stringify({
                message: "✅ Combo updated successfully",
                combo_id: comboId,
                success: true,
                changes: {
                    inserted: toInsert.length,
                    updated: toUpdate.length,
                    deleted: toDelete.length
                }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error in update-combo:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
