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

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
        const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
        const search = url.searchParams.get("search") ?? "";
        const id = url.searchParams.get("id");

        // Scenario A: Get Single Combo by ID (if 'id' param provided)
        if (id) {
            const { data: combo, error: comboErr } = await supabase
                .from("combo")
                .select("*")
                .eq("combo_id", id)
                .single();

            if (comboErr) throw new Error(comboErr.message);

            const { data: items, error: itemsErr } = await supabase
                .from("combo_items")
                .select("*, variant:product_variants(*)")
                .eq("combo_id", id);

            if (itemsErr) throw new Error(itemsErr.message);

            return new Response(
                JSON.stringify({ combo, items }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Scenario B: List Combos
        let query = supabase
            .from("combo")
            .select("*", { count: "exact" })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (search) {
            query = query.ilike("name", `%${search}%`);
        }

        const { data: combos, error: comboErr, count } = await query;

        if (comboErr) throw new Error(comboErr.message);

        // Fetch items for these combos to show details (e.g. counts)
        const comboIds = combos.map((c) => c.combo_id);
        let comboItems: any[] = [];

        if (comboIds.length > 0) {
            const { data: items, error: itemsErr } = await supabase
                .from("combo_items")
                .select(`
          combo_id,
          combo_item_id,
          quantity_per_combo,
          variant_id
        `)
                .in("combo_id", comboIds);

            if (itemsErr) throw new Error(itemsErr.message);
            comboItems = items ?? [];
        }

        // Group items
        const combosWithItems = combos.map(combo => ({
            ...combo,
            items: comboItems.filter(i => i.combo_id === combo.combo_id)
        }));

        return new Response(
            JSON.stringify({
                data: combosWithItems,
                total: count ?? 0
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error in get-combos:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
