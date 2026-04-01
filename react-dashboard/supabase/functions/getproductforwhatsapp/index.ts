import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        const { sku } = await req.json();

        if (!sku) {
            return new Response(JSON.stringify({ error: "SKU is required" }), { status: 400 });
        }

        // --- Product Variant ---
        const { data: productVariant, error: variantErr } = await supabase
            .from("master_product")
            .select(`
        product_id,
        name,
        description,
        has_variant,
        image_url,
        is_Active,
        product_variants (
          variant_id,
          variant_name,
          sku,
          regularprice,
          saleprice,
          color,
          size,
          length,
          is_Active
        )
      `)
            .eq("sku", sku)
            .single();

        if (variantErr && variantErr.code !== "PGRST116") {
            return new Response(
                JSON.stringify({ error: "Failed to fetch product variant", details: variantErr }),
                { status: 500 }
            );
        }

        if (productVariant) {
            const descEn = stripHtmlTags(productVariant.description);
            const descTa = await translateToTamil(descEn);

            // ✅ Clean up variant array
            const variants = productVariant.product_variants?.map((v: any) => ({
                variant_id: v.variant_id,
                variant_name: v.variant_name,
                sku: v.sku,
                saleprice: v.saleprice,
                regularprice: v.regularprice,
                color: v.color,
                size: v.size,
                length: v.length,
                is_Active: v.is_Active,
            })) ?? [];

            // ✅ Detect variant type
            let variantType = "";
            if (variants.some((v) => v.size)) variantType = "size";
            else if (variants.some((v) => v.color)) variantType = "color";
            else if (variants.some((v) => v.length)) variantType = "length";

            return new Response(
                JSON.stringify({
                    type: "product",
                    details: {
                        ...productVariant,
                        description_en: descEn,
                        description_ta: descTa,
                        variantType
                    },
                }),
                { status: 200 }
            );
        }

        // --- Combo ---
        const { data: combo, error: comboErr } = await supabase
            .from("combo")
            .select(`
        combo_id,
        name,
        description,
        image_url,
        sku,
        regularprice,
        saleprice,
        is_active,
        combo_items (
          variant_id,
          quantity_per_combo
        )
      `)
            .eq("sku", sku)
            .single();

        if (comboErr && comboErr.code !== "PGRST116") {
            return new Response(
                JSON.stringify({ error: "Failed to fetch combo", details: comboErr }),
                { status: 500 }
            );
        }

        if (combo) {
            const descEn = stripHtmlTags(combo.description);
            const descTa = await translateToTamil(descEn).catch((e) => {
                console.error("Translation failed:", e);
                return descEn; // fallback
            });

            return new Response(
                JSON.stringify({
                    type: "combo",
                    details: {
                        combo_id: combo.combo_id,
                        name: combo.name,
                        description_en: descEn,
                        description_ta: descTa,
                        image_url: combo.image_url,
                        items: combo.combo_items.map((entry: any) => ({
                            variant_id: entry.variant_id,
                            quantity: entry.quantity_per_combo,
                            variant_name: entry.product_variants?.variant_name ?? "N/A",
                            sale_price: entry.product_variants?.saleprice ?? 0,
                            sku: entry.product_variants?.sku ?? null,
                            product: entry.product_variants?.product ?? null,
                        })),
                    },
                }),
                { status: 200 }
            );
        }

        return new Response(
            JSON.stringify({ error: "No product or combo found for given SKU" }),
            { status: 404 }
        );
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: "Internal error", details: err.message }),
            { status: 500 }
        );
    }
});

function stripHtmlTags(input: string): string {
    if (!input) return "";
    return input.replace(/<\/?[^>]+(>|$)/g, "");
}

// 🚀 Stub translator – replace with real API or DB Tamil column
async function translateToTamil(text: string): Promise<string> {
    if (!text) return "";
    const apiKey = 'AIzaSyANKx2HvSV96hvuZ9LlWz71yQ-IyoDZcjA'; // set in Supabase env
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

    const body = {
        q: text,
        target: "ta", // Tamil language code
        source: "en",
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const json = await res.json();
    return json.data?.translations?.[0]?.translatedText ?? text;
}
