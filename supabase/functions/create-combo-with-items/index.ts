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

        const body = await req.json();
        const { name, description, saleprice, regularprice, sku, image_url, items, combo_quantity, subcategory_id } = body;

        // Validation
        if (!name || !saleprice || !Array.isArray(items) || items.length === 0) {
            return new Response(
                JSON.stringify({ error: "Missing required fields or invalid items" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Correct logic: combo_quantity is User Input (Stock), not sum of items. 
        // Default to 0 if not provided. logic handled by DB default (0), but we pass it if present.
        const stockQuantity = combo_quantity !== undefined ? Number(combo_quantity) : 0;

        // 1. Insert Combo (Let DB generate combo_id)
        const { data: combo, error: insertComboErr } = await supabase
            .from("combo")
            .insert({
                name: name.trim(),
                sku: sku?.trim() || null,
                description,
                saleprice,
                regularprice,
                combo_quantity: stockQuantity,
                image_url: image_url || null,
                subcategory_id: subcategory_id || null,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select('combo_id')
            .single();

        if (insertComboErr) throw new Error(`Failed to insert combo: ${insertComboErr.message}`);

        const newComboId = combo.combo_id;

        // 2. Prepare Items (Let DB generate combo_item_id)
        const comboItems = items.map((item: any) => ({
            combo_id: newComboId,
            variant_id: item.variant_id,
            quantity_per_combo: Number(item.quantity_per_combo)
        }));

        // 3. Insert Items
        const { error: insertItemsErr } = await supabase
            .from("combo_items")
            .insert(comboItems);

        if (insertItemsErr) {
            // Rollback combo if items fail
            console.error("Inserting items failed, rolling back combo...", insertItemsErr);
            await supabase.from("combo").delete().eq("combo_id", newComboId);
            throw new Error(`Failed to insert combo items: ${insertItemsErr.message}`);
        }

        return new Response(
            JSON.stringify({
                message: "✅ Combo created successfully",
                combo_id: newComboId,
                success: true
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Edge Function Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
