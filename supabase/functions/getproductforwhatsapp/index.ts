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

        // --- Smart SKU resolution ---
        // Users enter short codes (e.g. "9111") but DB SKUs have RFP- prefix (e.g. "RFP-CMB9111")
        // Try: exact → RFP-{code} → partial suffix match
        async function resolveVariantBySku(code: string) {
            // 1. Exact match
            const { data: exact } = await supabase
                .from("product_variants")
                .select("variant_id, product_id, sku")
                .eq("sku", code)
                .maybeSingle();
            if (exact) return exact;

            // 2. Try with RFP- prefix
            const { data: prefixed } = await supabase
                .from("product_variants")
                .select("variant_id, product_id, sku")
                .eq("sku", `RFP-${code}`)
                .maybeSingle();
            if (prefixed) return prefixed;

            // 3. Partial suffix match (e.g. "9111" matches "RFP-CMB9111")
            const { data: partial } = await supabase
                .from("product_variants")
                .select("variant_id, product_id, sku")
                .ilike("sku", `%${code}`)
                .limit(1)
                .maybeSingle();
            if (partial) return partial;

            return null;
        }

        async function resolveMasterBySku(code: string) {
            // 1. Exact match
            const { data: exact } = await supabase
                .from("master_product")
                .select("product_id, sku")
                .eq("sku", code)
                .maybeSingle();
            if (exact) return exact;

            // 2. Try with RFP- prefix
            const { data: prefixed } = await supabase
                .from("master_product")
                .select("product_id, sku")
                .eq("sku", `RFP-${code}`)
                .maybeSingle();
            if (prefixed) return prefixed;

            // 3. Partial suffix match
            const { data: partial } = await supabase
                .from("master_product")
                .select("product_id, sku")
                .ilike("sku", `%${code}`)
                .limit(1)
                .maybeSingle();
            if (partial) return partial;

            return null;
        }

        async function resolveComboBySku(code: string) {
            // 1. Exact match
            const { data: exact } = await supabase
                .from("combo")
                .select("combo_id, sku")
                .eq("sku", code)
                .maybeSingle();
            if (exact) return exact;

            // 2. Try with RFP- prefix
            const { data: prefixed } = await supabase
                .from("combo")
                .select("combo_id, sku")
                .eq("sku", `RFP-${code}`)
                .maybeSingle();
            if (prefixed) return prefixed;

            // 3. Partial suffix match
            const { data: partial } = await supabase
                .from("combo")
                .select("combo_id, sku")
                .ilike("sku", `%${code}`)
                .limit(1)
                .maybeSingle();
            if (partial) return partial;

            return null;
        }

        // --- Product Variant ---
        // Step 1: Find the variant by SKU (with smart resolution)
        const matchedVariant = await resolveVariantBySku(sku);



        if (matchedVariant) {
            // Step 2: Fetch the full product using product_id from matched variant
            const { data: productVariant, error: productErr } = await supabase
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
                .eq("product_id", matchedVariant.product_id)
                .single();

            if (productErr) {
                return new Response(
                    JSON.stringify({ error: "Failed to fetch product", details: productErr }),
                    { status: 500 }
                );
            }

            const descEn = stripHtmlTags(productVariant.description);
            const descTa = descEn; // 🚀 BACKGROUND TRANSLATION DISABLED TO PREVENT WORKER STARVING

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

        // --- Fallback: Simple product (SKU on master_product, no variants) ---
        const resolvedMaster = await resolveMasterBySku(sku);
        let simpleProduct = null;
        if (resolvedMaster) {
            const { data } = await supabase
                .from("master_product")
                .select(`
                    product_id,
                    name,
                    description,
                    has_variant,
                    image_url,
                    is_Active,
                    sku,
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
                .eq("product_id", resolvedMaster.product_id)
                .single();
            simpleProduct = data;
        }

        if (simpleProduct) {
            const descEn = stripHtmlTags(simpleProduct.description);
            const descTa = descEn;

            const variants = simpleProduct.product_variants?.map((v: any) => ({
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

            let variantType = "";
            if (variants.some((v) => v.size)) variantType = "size";
            else if (variants.some((v) => v.color)) variantType = "color";
            else if (variants.some((v) => v.length)) variantType = "length";

            return new Response(
                JSON.stringify({
                    type: "product",
                    details: {
                        ...simpleProduct,
                        description_en: descEn,
                        description_ta: descTa,
                        variantType
                    },
                }),
                { status: 200 }
            );
        }

        // --- Combo ---
        const resolvedCombo = await resolveComboBySku(sku);
        let combo = null;
        if (resolvedCombo) {
            const { data } = await supabase
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
                .eq("combo_id", resolvedCombo.combo_id)
                .single();
            combo = data;
        }

        if (combo) {
            const descEn = stripHtmlTags(combo.description);
            const descTa = descEn; // 🚀 BACKGROUND TRANSLATION DISABLED TO PREVENT WORKER STARVING

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
