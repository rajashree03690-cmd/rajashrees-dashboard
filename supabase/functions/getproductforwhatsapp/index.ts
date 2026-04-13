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
            return new Response(JSON.stringify({ error: "SKU is required", found: false }), { status: 200 });
        }

        // --- Helpers ---
        function sanitizeImageUrl(url: string | null | undefined): string {
            if (!url) return "";
            if (url.startsWith("data:")) return ""; // base64 blob — too large for webhook
            return url;
        }

        function stripHtmlTags(input: string): string {
            if (!input) return "";
            return input.replace(/<\/?[^>]+(>|$)/g, "");
        }

        // Pick best image: prefer variant HTTPS images over master product (which are often base64)
        function pickBestImage(masterUrl: string | null, variants: any[]): string {
            // Try master first if it's a proper URL
            const masterClean = sanitizeImageUrl(masterUrl);
            if (masterClean) return masterClean;
            // Fallback: find the first variant with a valid HTTPS image
            for (const v of variants) {
                const vImg = sanitizeImageUrl(v.image_url);
                if (vImg) return vImg;
            }
            // Ultimate fallback: Official Brand Logo if only base64 or null existed
            return "https://gvsorguincvinuiqtooo.supabase.co/storage/v1/object/public/product-images/rajashree-fallback-logo.png";
        }

        // --- Smart SKU Resolution (4-priority fuzzy matching) ---
        const originalCode = String(sku || '').trim();
        const normalizedCode = originalCode.replace(/^RFP[-\s]*/i, '');
        const numMatch = normalizedCode.match(/\d+$/);
        const numericCode = numMatch ? numMatch[0] : null;

        async function advancedResolve(tableName: string, idColumn: string) {
            const cols = `${idColumn}, sku`;
            // Priority 1: Exact match
            const { data: e1 } = await supabase.from(tableName).select(cols).eq("sku", originalCode).limit(1).maybeSingle();
            if (e1) return e1;
            // Priority 2: RFP- prefix
            const { data: e2 } = await supabase.from(tableName).select(cols).eq("sku", `RFP-${normalizedCode}`).limit(1).maybeSingle();
            if (e2) return e2;
            // Priority 3: Suffix match — order by sku length so shortest (most specific) wins
            const { data: p1 } = await supabase.from(tableName).select(cols).ilike("sku", `%${normalizedCode}`).order('sku', { ascending: true }).limit(1).maybeSingle();
            if (p1) return p1;
            // Priority 4: Digits-only fallback (min 3 digits)
            if (numericCode && numericCode.length >= 3) {
                const { data: p2 } = await supabase.from(tableName).select(cols).ilike("sku", `%${numericCode}`).order('sku', { ascending: true }).limit(1).maybeSingle();
                if (p2) return p2;
            }
            return null;
        }

        // --- 1. Try product_variants table first ---
        const matchedVariant = await advancedResolve("product_variants", "product_id, variant_id");

        if (matchedVariant) {
            const { data: product, error: productErr } = await supabase
                .from("master_product")
                .select(`
                    product_id, name, description, has_variant, image_url, is_Active,
                    product_variants (
                      variant_id, variant_name, sku, regularprice, saleprice,
                      color, size, length, is_Active, image_url
                    )
                `)
                .eq("product_id", matchedVariant.product_id)
                .single();

            if (productErr) {
                return new Response(
                    JSON.stringify({ error: "Failed to fetch product", found: false }),
                    { status: 200 }
                );
            }

            const variants = product.product_variants ?? [];
            const description = stripHtmlTags(product.description);
            const bestImage = pickBestImage(product.image_url, variants);

            let variantType = "";
            if (variants.some((v: any) => v.size)) variantType = "size";
            else if (variants.some((v: any) => v.color)) variantType = "color";
            else if (variants.some((v: any) => v.length)) variantType = "length";

            return new Response(
                JSON.stringify({
                    type: "product",
                    details: {
                        product_id: product.product_id,
                        default_variant_id: variants[0]?.variant_id || product.product_id,
                        name: product.name,
                        description,
                        description_en: description,
                        has_variant: product.has_variant,
                        image_url: bestImage,
                        is_Active: product.is_Active,
                        variantType,
                        
                        // Flattened variant properties required by Libromi Bot Math:
                        variant_id: variants[0]?.variant_id,
                        variant_name: variants[0]?.variant_name,
                        sku: variants[0]?.sku,
                        saleprice: variants[0]?.saleprice || 0,
                        regularprice: variants[0]?.regularprice || 0,
                        color: variants[0]?.color,
                        size: variants[0]?.size,
                        length: variants[0]?.length,
                        
                        product_variants: variants.map((v: any) => ({
                            variant_id: v.variant_id,
                            variant_name: v.variant_name,
                            sku: v.sku,
                            saleprice: v.saleprice,
                            regularprice: v.regularprice,
                            color: v.color,
                            size: v.size,
                            length: v.length,
                            is_Active: v.is_Active,
                        })),
                    },
                }),
                { status: 200 }
            );
        }

        // --- 2. Try master_product table (simple products) ---
        const resolvedMaster = await advancedResolve("master_product", "product_id");

        if (resolvedMaster) {
            const { data: product } = await supabase
                .from("master_product")
                .select(`
                    product_id, name, description, has_variant, image_url, is_Active, sku,
                    product_variants (
                      variant_id, variant_name, sku, regularprice, saleprice,
                      color, size, length, is_Active, image_url
                    )
                `)
                .eq("product_id", resolvedMaster.product_id)
                .single();

            if (product) {
                const variants = product.product_variants ?? [];
                const description = stripHtmlTags(product.description);
                const bestImage = pickBestImage(product.image_url, variants);

                let variantType = "";
                if (variants.some((v: any) => v.size)) variantType = "size";
                else if (variants.some((v: any) => v.color)) variantType = "color";
                else if (variants.some((v: any) => v.length)) variantType = "length";

                return new Response(
                    JSON.stringify({
                        type: "product",
                        details: {
                            product_id: product.product_id,
                            default_variant_id: product.product_variants?.[0]?.variant_id || product.product_id,
                            name: product.name,
                            description,
                            description_en: description,
                            has_variant: product.has_variant,
                            image_url: bestImage,
                            is_Active: product.is_Active,
                            sku: product.sku,
                            variantType,
                            
                            // Flattened root variables for bots
                            saleprice: variants[0]?.saleprice || 0,
                            regularprice: variants[0]?.regularprice || 0,
                            variant_id: variants[0]?.variant_id,
                            
                            product_variants: variants.map((v: any) => ({
                                variant_id: v.variant_id,
                                variant_name: v.variant_name,
                                sku: v.sku,
                                saleprice: v.saleprice,
                                regularprice: v.regularprice,
                                color: v.color,
                                size: v.size,
                                length: v.length,
                                is_Active: v.is_Active,
                            })),
                        },
                    }),
                    { status: 200 }
                );
            }
        }

        // --- 3. Try combo table ---
        const resolvedCombo = await advancedResolve("combo", "combo_id");

        if (resolvedCombo) {
            const { data: combo } = await supabase
                .from("combo")
                .select(`
                    combo_id, name, description, image_url, sku,
                    regularprice, saleprice, is_active,
                    combo_items ( variant_id, quantity_per_combo )
                `)
                .eq("combo_id", resolvedCombo.combo_id)
                .single();

            if (combo) {
                return new Response(
                    JSON.stringify({
                        type: "combo",
                        details: {
                            combo_id: combo.combo_id,
                            default_variant_id: combo.combo_id, // combos use their own ID directly
                            name: combo.name,
                            description: stripHtmlTags(combo.description),
                            description_en: stripHtmlTags(combo.description),
                            image_url: sanitizeImageUrl(combo.image_url),
                            sku: combo.sku,
                            regularprice: combo.regularprice,
                            saleprice: combo.saleprice,
                            items: combo.combo_items?.map((entry: any) => ({
                                variant_id: entry.variant_id,
                                quantity: entry.quantity_per_combo,
                            })) ?? [],
                        },
                    }),
                    { status: 200 }
                );
            }
        }

        return new Response(
            JSON.stringify({ error: "No product or combo found for given SKU", found: false }),
            { status: 200 }
        );
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: "Internal error", details: err.message, found: false }),
            { status: 200 }
        );
    }
});
