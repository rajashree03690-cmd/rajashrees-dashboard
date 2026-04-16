import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers":
                    "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    try {
        const body = await req.json();

        console.log("📤 Creating product:", body.name);
        console.log("📦 Payload keys:", Object.keys(body));

        // ✅ Validation
        if (
            body.has_variant &&
            (!Array.isArray(body.variants) || body.variants.length === 0)
        ) {
            console.error("❌ Validation failed: has_variant true but no variants");
            return new Response(
                JSON.stringify({
                    error: "has_variant is true, so variants must be provided.",
                }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    }
                }
            );
        }

        // ✅ Category/Subcategory mapping
        // Support both: direct subcategory_id (new frontend) OR category name lookup (legacy)
        let subcategoryId: number | null = null;

        if (body.subcategory_id && !isNaN(Number(body.subcategory_id))) {
            // New frontend sends subcategory_id directly as a number
            subcategoryId = parseInt(body.subcategory_id);
            console.log("✅ Subcategory ID from payload:", subcategoryId);
        } else if (body.category) {
            // Legacy: lookup by category name string
            const { data: subcatData, error: subcatError } = await supabase
                .from("subcategories")
                .select("subcategory_id")
                .ilike("name", body.category)
                .maybeSingle();

            if (subcatError) {
                console.error("❌ Subcategory lookup failed:", subcatError);
            } else if (!subcatData) {
                console.warn("⚠️ Subcategory not found:", body.category);
            } else {
                subcategoryId = subcatData.subcategory_id;
                console.log("✅ Subcategory mapped:", subcategoryId);
            }
        }

        // ✅ Handle category_id - support direct ID from frontend
        let categoryId: number | null = null;
        if (body.category_id && !isNaN(Number(body.category_id))) {
            categoryId = parseInt(body.category_id);
            console.log("✅ Category ID from payload:", categoryId);
        }

        // ✅ Handle images - support both: images[] array (new frontend) OR image_url string (legacy)
        let imageUrl = body.image_url || null;
        let image2Url = body.image_2_url || null;
        let image3Url = body.image_3_url || null;

        if (Array.isArray(body.images) && body.images.length > 0) {
            imageUrl = body.images[0] || imageUrl;
            image2Url = body.images[1] || image2Url;
            image3Url = body.images[2] || image3Url;
            console.log("✅ Images mapped from array:", body.images.length, "images");
        }

        // ✅ Generate next product_id (table has no auto-increment)
        let nextProductId = body.product_id || null;

        if (!nextProductId) {
            const { data: maxRow } = await supabase
                .from("master_product")
                .select("product_id")
                .order("product_id", { ascending: false })
                .limit(1)
                .single();

            nextProductId = (maxRow?.product_id || 134000) + 1;
            console.log("✅ Generated next product_id:", nextProductId);
        }

        // ✅ Insert into master_product
        const productToInsert: any = {
            product_id: nextProductId,
            name: body.name,
            description: body.description || null,
            short_description: body.short_description || null,
            sku: body.sku,
            has_variant: body.has_variant ?? false,
            subcategory_id: subcategoryId,
            category_id: categoryId,
            image_url: imageUrl,
            image_2_url: image2Url,
            image_3_url: image3Url,
            "is_Active": body.is_active ?? true,
            created_at: new Date().toISOString(),
        };

        console.log("📝 Inserting into master_product:", JSON.stringify(productToInsert));

        const isEditing = !!body.product_id;

        const { data: masterProduct, error: insertMasterError } = isEditing
            ? await supabase
                .from("master_product")
                .upsert([productToInsert])
                .select("product_id")
                .single()
            : await supabase
                .from("master_product")
                .insert([productToInsert])
                .select("product_id")
                .single();

        if (insertMasterError) {
            console.error("❌ Master product insert failed:", insertMasterError);
            return new Response(
                JSON.stringify({
                    error: "Failed to insert into master_product",
                    details: insertMasterError,
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    }
                }
            );
        }

        console.log("✅ Product created:", masterProduct.product_id);

        // ✅ SKU Validation - Check for duplicates before inserting variants
        const skusToCheck: string[] = [];

        if (body.has_variant && Array.isArray(body.variants) && body.variants.length > 0) {
            body.variants.forEach((v: any) => {
                if (v.sku) skusToCheck.push(v.sku);
            });
        } else if (body.variants && body.variants.length > 0 && body.variants[0].sku) {
            skusToCheck.push(body.variants[0].sku);
        }

        if (skusToCheck.length > 0) {
            const { data: existingSKUs, error: skuCheckError } = await supabase
                .from("product_variants")
                .select("sku, variant_id, product_id")
                .in("sku", skusToCheck);

            if (!skuCheckError && existingSKUs && existingSKUs.length > 0) {
                const duplicates = existingSKUs.filter(
                    (existing: any) => existing.product_id !== masterProduct.product_id
                );

                if (duplicates.length > 0) {
                    const duplicateSKUs = duplicates.map((d: any) => d.sku).join(", ");
                    console.error("❌ Duplicate SKU(s) found:", duplicateSKUs);

                    if (!body.product_id) {
                        await supabase
                            .from("master_product")
                            .delete()
                            .eq("product_id", masterProduct.product_id);
                    }

                    return new Response(
                        JSON.stringify({
                            error: `SKU already exists: ${duplicateSKUs}`,
                            message: `The SKU "${duplicateSKUs}" is already in use by another product. Please use a different SKU.`,
                            duplicateSKUs: duplicates.map((d: any) => d.sku),
                        }),
                        {
                            status: 400,
                            headers: {
                                "Content-Type": "application/json",
                                "Access-Control-Allow-Origin": "*",
                            }
                        }
                    );
                }
            }
        }

        // ✅ Helper: normalize variant data from both old and new frontend format
        const normalizeVariant = (variant: any, isVariantFlag: boolean) => ({
            product_id: masterProduct.product_id,
            variant_name: variant.variant_name || `${body.name} - ${variant.size || 'Default'}`,
            sku: variant.sku || `${body.sku}-${variant.size || 'default'}`,
            saleprice: parseFloat(variant.saleprice ?? variant.sale_price ?? 0) || 0,
            regularprice: parseFloat(variant.regularprice ?? variant.regular_price ?? 0) || 0,
            costprice: parseFloat(variant.costprice ?? variant.cost_price ?? 0) || null,
            stock: parseInt(variant.stock ?? variant.stock_quantity ?? 0) || 0,
            weight: parseFloat(variant.weight) || null,
            length: variant.length || null,
            size: variant.size || null,
            color: variant.color || null,
            image_url: variant.image_url || imageUrl || null,
            image_2_url: variant.image_2_url || image2Url || null,
            image_3_url: variant.image_3_url || image3Url || null,
            is_variant: isVariantFlag,
            "is_Active": true,
        });

        // ✅ Variants insert
        if (body.has_variant && Array.isArray(body.variants) && body.variants.length > 0) {
            const variants = body.variants.map((variant: any) => normalizeVariant(variant, true));

            console.log("📝 Inserting", variants.length, "variants");

            const { error: variantInsertErr } = await supabase
                .from("product_variants")
                .insert(variants);

            if (variantInsertErr) {
                console.error("❌ Variant insert failed, rolling back:", variantInsertErr);
                console.error("Full error details:", JSON.stringify(variantInsertErr, null, 2));

                await supabase
                    .from("master_product")
                    .delete()
                    .eq("product_id", masterProduct.product_id);

                return new Response(
                    JSON.stringify({
                        error: "Failed to insert variants",
                        details: variantInsertErr,
                        message: variantInsertErr.message,
                        hint: variantInsertErr.hint,
                        code: variantInsertErr.code,
                    }),
                    {
                        status: 500,
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*",
                        }
                    }
                );
            }

            console.log("✅ Variants created");
        } else if (!body.has_variant && Array.isArray(body.variants) && body.variants.length > 0) {
            // ✅ Single product without variants
            const variants = body.variants.map((variant: any) => normalizeVariant(variant, false));

            const { error: variantInsertErr } = await supabase
                .from("product_variants")
                .insert(variants);

            if (variantInsertErr) {
                console.error("❌ Single variant insert failed, rolling back:", variantInsertErr);
                console.error("Full error details:", JSON.stringify(variantInsertErr, null, 2));

                await supabase
                    .from("master_product")
                    .delete()
                    .eq("product_id", masterProduct.product_id);

                return new Response(
                    JSON.stringify({
                        error: "Failed to insert variants",
                        details: variantInsertErr,
                        message: variantInsertErr.message,
                        hint: variantInsertErr.hint,
                        code: variantInsertErr.code,
                    }),
                    {
                        status: 500,
                        headers: {
                            "Content-Type": "application/json",
                            "Access-Control-Allow-Origin": "*",
                        }
                    }
                );
            }

            console.log("✅ Single variant created");
        }

        console.log("✅ Product creation complete");

        return new Response(JSON.stringify({ success: true, product_id: masterProduct.product_id }), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers":
                    "authorization, x-client-info, apikey, content-type",
            },
        });
    } catch (err) {
        console.error("❌ Unhandled error:", err);
        return new Response(
            JSON.stringify({ error: "Unexpected server error", details: err.message }),
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
