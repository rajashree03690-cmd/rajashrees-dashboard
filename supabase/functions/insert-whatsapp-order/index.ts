import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { logEvent } from "../_shared/logger.ts"; // ✅ import logger

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    let payload: any;
    try {
        payload = await req.json();
    } catch (err) {
        await logEvent("insert-whatsapp-order", "Parse Payload", err, "error");
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: corsHeaders,
        });
    }

    await logEvent("insert-whatsapp-order", "Received Payload", payload, "success");
    console.log("📩 Received WhatsApp Order:", payload);

    let transformedItems: any[] = [];
    try {
        if (payload.type !== "ECOMBOT") {
            transformedItems = (payload.items || []).map((item: any) => ({
                variant_id: Number(item.variant_id),
                quantity: Number(item.quantity),
                price: Number(item.price || 0),
            }));
        } else {
            const rawText = payload.items || "";
            const lines = rawText.split("\n");
            const parsedItems: any[] = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                const matchSKU = line.match(/^\d+,\s*([A-Z0-9.\-]+)\s*:/i);
                if (matchSKU) {
                    const sku = matchSKU[1];
                    let quantity: number | null = null;
                    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                        const nextLine = lines[j].trim().replace(/[_()]/g, "").trim();
                        const matchDetails = nextLine.match(
                            /₹\s*([\d]+(?:\.\d+)?)\s*\*\s*(\d+)\s*quantity\s*₹\s*([\d]+(?:\.\d+)?)/
                        );
                        if (matchDetails) {
                            const unitPrice = parseFloat(matchDetails[1]);
                            quantity = parseInt(matchDetails[2], 10);
                            parsedItems.push({ sku, quantity, price: unitPrice });
                            break;
                        }
                    }
                    if (quantity && !parsedItems.some((i: any) => i.sku === sku)) parsedItems.push({ sku, quantity });
                }
            }

            await logEvent("insert-whatsapp-order", "Parsed SKUs", parsedItems, "success");

            // --- Smart SKU Resolution (deterministic — matches getproductforwhatsapp behavior) ---
            for (const item of parsedItems) {
                try {
                    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
                    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
                    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                    const headers = {
                        apikey: anonKey,
                        Authorization: `Bearer ${serviceKey}`,
                    };

                    const originalCode = String(item.sku || '').trim();
                    const normalizedCode = originalCode.replace(/^RFP[-\s]*/i, '');
                    const numMatch = normalizedCode.match(/\d+$/);
                    const numericCode = numMatch ? numMatch[0] : null;

                    // Helper: exact match (returns single row)
                    async function tryExactMatch(table: string, filter: string): Promise<any | null> {
                        const resp = await fetch(
                            `${supabaseUrl}/rest/v1/${table}?select=variant_id,saleprice,regularprice,sku&${filter}&limit=1`,
                            { method: "GET", headers }
                        );
                        if (!resp.ok) return null;
                        const data = await resp.json();
                        return data.length > 0 ? data[0] : null;
                    }

                    // Helper: fuzzy match — fetches ALL candidates, picks the BEST one
                    // Best = shortest SKU (most specific match) → then highest variant_id (newest)
                    async function tryFuzzyMatch(table: string, filter: string): Promise<any | null> {
                        const resp = await fetch(
                            `${supabaseUrl}/rest/v1/${table}?select=variant_id,saleprice,regularprice,sku&${filter}&order=sku.asc&limit=10`,
                            { method: "GET", headers }
                        );
                        if (!resp.ok) return null;
                        const data = await resp.json();
                        if (data.length === 0) return null;
                        if (data.length === 1) return data[0];
                        // Pick the shortest SKU (closest to exact match)
                        data.sort((a: any, b: any) => {
                            const lenDiff = (a.sku || '').length - (b.sku || '').length;
                            if (lenDiff !== 0) return lenDiff;
                            // Same length: prefer highest variant_id (newest product)
                            return (b.variant_id || 0) - (a.variant_id || 0);
                        });
                        return data[0];
                    }

                    // Also try combo table
                    async function tryComboMatch(filter: string): Promise<any | null> {
                        const resp = await fetch(
                            `${supabaseUrl}/rest/v1/combo?select=combo_id,saleprice,regularprice,sku&${filter}&limit=1`,
                            { method: "GET", headers }
                        );
                        if (!resp.ok) return null;
                        const data = await resp.json();
                        return data.length > 0 ? data[0] : null;
                    }

                    let matched: any = null;
                    let isComboItem = false;

                    // Priority 1: Exact match on product_variants (deterministic)
                    matched = await tryExactMatch("product_variants", `sku=eq.${originalCode}`);
                    // Priority 2: RFP- prefix exact match (deterministic)
                    if (!matched) matched = await tryExactMatch("product_variants", `sku=eq.RFP-${normalizedCode}`);
                    // Priority 3: Suffix fuzzy match — picks BEST from candidates
                    if (!matched) matched = await tryFuzzyMatch("product_variants", `sku=ilike.*${normalizedCode}`);
                    // Priority 4: Digits-only fuzzy fallback (min 3 digits)
                    if (!matched && numericCode && numericCode.length >= 3) {
                        matched = await tryFuzzyMatch("product_variants", `sku=ilike.*${numericCode}`);
                    }

                    // Priority 5: Try combo table
                    if (!matched) {
                        let comboMatch = await tryComboMatch(`sku=eq.${originalCode}`);
                        if (!comboMatch) comboMatch = await tryComboMatch(`sku=ilike.*${normalizedCode}`);
                        if (comboMatch) {
                            matched = { variant_id: comboMatch.combo_id, saleprice: comboMatch.saleprice, regularprice: comboMatch.regularprice, sku: comboMatch.sku };
                            isComboItem = true;
                        }
                    }

                    if (matched) {
                        const variantId = Number(matched.variant_id);
                        const dbPrice = Number(matched.saleprice || matched.regularprice || 0);
                        const finalPrice = item.price || dbPrice;
                        if (variantId && !isNaN(variantId) && variantId > 0) {
                            transformedItems.push({
                                variant_id: variantId,
                                quantity: item.quantity,
                                price: finalPrice,
                                sku: matched.sku,
                                is_combo: isComboItem
                            });
                            await logEvent("insert-whatsapp-order", `Resolved SKU ${originalCode}`, { resolvedSku: matched.sku, variant_id: variantId, price: finalPrice, is_combo: isComboItem }, "success");
                        } else {
                            await logEvent("insert-whatsapp-order", "Invalid variant data", { sku: item.sku, variant_id: variantId, price: finalPrice }, "error");
                        }
                    } else {
                        await logEvent("insert-whatsapp-order", "SKU Not Found (all strategies failed)", { sku: originalCode, normalized: normalizedCode }, "error");
                    }
                } catch (err) {
                    await logEvent("insert-whatsapp-order", `Exception Resolving SKU ${item.sku}`, err, "error");
                }
            }
        }
    } catch (err) {
        await logEvent("insert-whatsapp-order", "Transform Items", err, "error");
    }

    // --- Customer Lookup ---
    let primaryMobile = Number(payload.mobileNumber);
    let customerId: number | null = null;
    try {
        if (primaryMobile) {
            const response = await fetch(
                `${Deno.env.get("SUPABASE_URL")}/rest/v1/customers?select=customer_id&mobile_number=eq.${primaryMobile}`,
                {
                    method: "GET",
                    headers: {
                        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
                        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    },
                },
            );

            if (response.ok) {
                const customers = await response.json();
                if (customers.length > 0) {
                    customerId = customers[0].customer_id;
                    await logEvent("insert-whatsapp-order", "Existing Customer Found", customerId, "success");
                } else {
                    await logEvent("insert-whatsapp-order", "Customer Not Found", primaryMobile, "success");
                }
            } else {
                await logEvent("insert-whatsapp-order", "Customer Fetch Error", await response.text(), "error");
            }
        }
    } catch (err) {
        await logEvent("insert-whatsapp-order", "Customer Lookup Exception", err, "error");
    }

    // ✅ Safety Check: Abort if no products were found
    if (transformedItems.length === 0) {
        await logEvent("insert-whatsapp-order", "Abort Order", "No valid items found", "error");
        return new Response(JSON.stringify({
            error: "No products found for the given items. Order aborted to prevent empty checkout."
        }), {
            status: 400,
            headers: corsHeaders,
        });
    }

    const orderPayload = {
        order_date: new Date().toISOString(),
        orderStatus: payload.orderStatus?.toLowerCase(),
        customer_id: customerId,
        customer_name: payload.customer_name || "WhatsApp User",
        address: (payload.address || "").replace(/\n+/g, " ").trim(),
        state: payload.state || "",
        pincode: payload.pincode || "",
        shipping_address: (payload.address || "").replace(/\n+/g, " ").trim(),
        shipping_state: payload.state || "",
        shipping_pincode: payload.pincode || "",
        contact_number: (payload.alternateNumber || "").replace(/\s+/g, ""),
        name: payload.customer_name || "",
        mobileNumber: primaryMobile || "",
        email: payload.email || "",
        total_amount: parseFloat(payload.total_amount) || 0,
        source: "WhatsApp",
        shipping_amount: parseFloat(payload.shipping_amount) || 0,
        payment_method: payload.paymentMethod || payload.payment_method || "COD",  // ✅ Use actual payment method
        payment_transaction_id: payload.payment_transaction_id || "",
        order_note: payload.customer_note || "",
        items: transformedItems,
    };

    await logEvent("insert-whatsapp-order", "Prepared Order Payload", orderPayload, "success");

    // --- Forward to insert-new-order function (handles flat WhatsApp payloads with payment validation) ---
    try {
        const insertResponse = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/insert-new-order`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
                },
                body: JSON.stringify(orderPayload),
            },
        );

        const result = await insertResponse.json();

        // Log with proper status indication
        if (insertResponse.ok) {
            console.log("✅ Order created successfully:", result);
            await logEvent("insert-whatsapp-order", "Order Created Successfully", result, "success");
        } else {
            console.error("❌ orders-create FAILED:", {
                status: insertResponse.status,
                statusText: insertResponse.statusText,
                error: result
            });
            await logEvent("insert-whatsapp-order", `orders-create ERROR (${insertResponse.status})`, result, "error");
        }

        return new Response(JSON.stringify(result), {
            status: insertResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        await logEvent("insert-whatsapp-order", "Insert-New-Order Exception", err, "error");
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: corsHeaders,
        });
    }
});
