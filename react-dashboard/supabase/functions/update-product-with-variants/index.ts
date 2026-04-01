import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    // 1. CORS Setup
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        const body = await req.json();
        console.log("📤 Updating product:", body.product_id, body.name);

        if (!body.product_id) {
            throw new Error("product_id is required");
        }

        // 2. Map Category (if provided as string)
        let subcategoryId = body.subcategory_id;
        if (body.category && !subcategoryId) {
            const { data: subcatData } = await supabase
                .from("subcategories")
                .select("subcategory_id")
                .ilike("name", body.category)
                .maybeSingle();
            if (subcatData) subcategoryId = subcatData.subcategory_id;
        }

        // 3. Update Master Product
        const productUpdate: any = {
            name: body.name,
            description: body.description,
            sku: body.sku,
            has_variant: body.has_variant,
            subcategory_id: subcategoryId,
            image_url: body.image_url,
            image_2_url: body.image_2_url || null,
            image_3_url: body.image_3_url || null,
            is_Active: body.is_Active !== undefined ? body.is_Active : true,
            // Don't update created_at usually
        };

        const { error: masterError } = await supabase
            .from("master_product")
            .update(productUpdate)
            .eq("product_id", body.product_id);

        if (masterError) {
            console.error("❌ Master product update failed:", masterError);
            throw masterError;
        }

        console.log("✅ Master product updated");

        // 4. Handle Variants
        if (Array.isArray(body.variants)) {
            const variants = body.variants.map((variant: any) => ({
                product_id: body.product_id,
                variant_id: variant.variant_id, // If present, it updates. If null, it inserts (if DB allows, see below)
                variant_name: variant.variant_name || productUpdate.name,
                sku: variant.sku,
                saleprice: variant.saleprice,
                regularprice: variant.regularprice,
                stock: variant.stock ?? 0,
                weight: variant.weight,
                length: variant.length ?? null,
                size: variant.size ?? null,
                color: variant.color ?? null,
                image_url: variant.image_url ?? body.image_url, // Default to product image if missing
                is_variant: body.has_variant,
                is_Active: variant.is_Active !== undefined ? variant.is_Active : true,
                // created_at?
            }));

            // Filter out variants without IDs for insert, separate updates?
            // "upsert" works if validation allows. 
            // In the create function, we passed explicit IDs? No, we mapped them.
            // For update, the frontend sends variant_id if it exists.

            // Note: Postgres 'upsert' needs a primary key match to update.
            // If variant_id is missing, Supabase might try to insert with null ID (which fails if PK).
            // We need to remove 'variant_id' key if it is null/undefined so PG generates it.

            const cleanVariants = variants.map((v: any) => {
                const { variant_id, ...rest } = v;
                return variant_id ? v : rest; // Keep ID if exists, remove if not
            });

            const { error: variantError } = await supabase
                .from("product_variants")
                .upsert(cleanVariants, { onConflict: 'variant_id' });

            if (variantError) {
                console.error("❌ Variant upsert failed:", variantError);
                throw variantError;
            }

            // Optional: Delete variants that are NOT in the body.variants list?
            // For safety, skipping this "Delete Missing" step unless explicitly requested, 
            // as it deletes data. The user asked for "Multi-Image Support", not "Fix Variant Sync".
        }

        console.log("✅ Update complete");

        return new Response(JSON.stringify({ success: true }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        });

    } catch (err) {
        console.error("❌ Error updating product:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                }
            }
        );
    }
});
