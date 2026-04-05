import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEvent } from "../_shared/logger.ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const {
      customer_id,
      customer_name,
      mobileNumber,
      address,
      state,
      email,
      pincode,
      name,
      shipping_address,
      shipping_state,
      shipping_pincode,
      contact_number,
      total_amount,
      shipping_amount,
      source,
      orderStatus,
      payment_method,
      payment_transaction_id,
      order_note,
      items
    } = body;

    if (!Array.isArray(items) || items.length === 0) {
      await logEvent("insert-new-order", "Order Validation", "Items are required", "error");
      return new Response(JSON.stringify({ error: "Items are required." }), { status: 400, headers: corsHeaders });
    }

    // --- Payment validation ---
    const RAZORPAY_KEY = Deno.env.get("RAZORPAY_KEY") || "";
    const RAZORPAY_SECRET = Deno.env.get("RAZORPAY_SECRET") || "";
    let authHeader = "";
    try {
      const encoder = new TextEncoder();
      authHeader = "Basic " + btoa(
        String.fromCharCode(...encoder.encode(`${RAZORPAY_KEY}:${RAZORPAY_SECRET}`))
      );
    } catch (authErr) {
      console.error("⚠️ Failed to build Razorpay auth header:", authErr);
    }

    let isPaid = false;
    let resolved_payment_id = "";     // The actual pay_... ID to store
    let payment_order_id = "";        // The Razorpay order ID (order_...)

    console.log("Order status:", orderStatus, "| payment_transaction_id:", payment_transaction_id);
    await logEvent("insert-new-order", "Order Status Check", `status=${orderStatus}, txId=${payment_transaction_id}`, "success");

    // Safe reference to payment_transaction_id (could be empty/undefined/null)
    const txId = (payment_transaction_id || "").trim();

    // --- Build order items: validate variant existence, detect combos ---
    // IMPORTANT: We trust the payload's prices (from WhatsApp bot / cart).
    // We do NOT re-fetch prices from DB because that causes mismatches
    // when product prices change between when the customer saw the price
    // and when the order is saved.
    const resolvedOrderItems = [];

    for (const item of items) {
      let isCombo = false;
      let resolvedVariantId = item.variant_id;

      // 1. Check if it's a combo (for is_combo flag only, NOT for price)
      try {
        const { data: comboCheck } = await supabase
          .from("combo")
          .select("combo_id")
          .eq("combo_id", item.variant_id)
          .limit(1);
        if (comboCheck && comboCheck.length > 0) {
          isCombo = true;
        }
      } catch (comboErr) {
        console.error("Error checking combo:", comboErr);
      }

      // 2. If not a combo, validate variant exists (and handle auto-resolve)
      if (!isCombo) {
        const { data: variantCheck } = await supabase
          .from("product_variants")
          .select("variant_id")
          .eq("variant_id", item.variant_id)
          .limit(1)
          .maybeSingle();

        if (!variantCheck) {
          // Auto-resolve fallback: Check if the ID provided was actually a product_id
          const { data: fallbackVariant } = await supabase
            .from("product_variants")
            .select("variant_id")
            .eq("product_id", item.variant_id)
            .eq("is_Active", true)
            .limit(1)
            .maybeSingle();

          if (fallbackVariant) {
            console.log(`⚠️ Auto-resolved: product_id ${item.variant_id} → variant_id ${fallbackVariant.variant_id}`);
            resolvedVariantId = fallbackVariant.variant_id;
          } else {
            console.error(`❌ Cannot resolve variant_id ${item.variant_id}`);
          }
        }
      }

      const q = item.quantity || 1;
      resolvedOrderItems.push({
        catalogue_product_id: resolvedVariantId,
        quantity: q,
        is_combo: isCombo
      });
    }

    // Trust the payload total_amount — this is what the customer saw and paid
    const correctedTotalAmount = Number(total_amount) || 0;

    // Only block if total is truly zero (invalid order)
    if (correctedTotalAmount <= 0) {
      console.error(`🚫 ZERO PRICE BLOCKED. total_amount is zero.`);
      await logEvent("insert-new-order", "Pricing Failsafe Block", `total_amount is zero`, "error");
      return new Response(JSON.stringify({ error: "Order Validation Failed: Total is ₹0." }), { status: 400, headers: corsHeaders });
    }

    if (orderStatus === "failed" || orderStatus === "processing" || orderStatus === "confirmed" || orderStatus === "pending") {
      if (orderStatus !== "failed") {

        // Only validate payment if we have a transaction ID and Razorpay credentials
        if (txId && authHeader) {

          try {
            if (txId.startsWith("plink_")) {
              // --- Payment Link ---
              const linkResponse = await fetch(
                `https://api.razorpay.com/v1/payment_links/${txId}`,
                { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
              );
              const linkData = await linkResponse.json();

              // 🎯 FIX: ALWAYS extract order_id from payment link, even if not yet paid.
              // This ensures the webhook can find this order later via razorpay_order_id.
              if (linkData.order_id) {
                payment_order_id = linkData.order_id;
                console.log(`📌 Extracted order_id from plink: ${payment_order_id}`);
              }

              if (linkData.status === "paid" || (linkData.payments?.length && linkData.payments[0].status === "captured")) {
                isPaid = true;
                const paymentId = linkData.payments?.[0]?.payment_id || "";
                if (paymentId) {
                  resolved_payment_id = paymentId;
                  try {
                    const paymentResponse = await fetch(
                      `https://api.razorpay.com/v1/payments/${paymentId}`,
                      { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
                    );
                    const paymentDetails = await paymentResponse.json();
                    payment_order_id = paymentDetails.order_id || payment_order_id || "";
                  } catch (payErr) {
                    console.error("⚠️ Failed to fetch payment details for plink:", payErr);
                    // Non-critical: we already have the payment ID
                  }
                }
              }

            } else if (txId.startsWith("pay_")) {
              // --- Direct Payment ID ---
              const paymentResponse = await fetch(
                `https://api.razorpay.com/v1/payments/${txId}`,
                { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
              );
              const paymentData = await paymentResponse.json();

              if (paymentData.status === "captured") {
                isPaid = true;
                resolved_payment_id = txId; // Already is the pay_ ID
                payment_order_id = paymentData.order_id || "";
              }

            } else if (txId.startsWith("order_")) {
              // --- Razorpay Order ID (WhatsApp bot sends this) ---
              const orderPaymentsRes = await fetch(
                `https://api.razorpay.com/v1/orders/${txId}/payments`,
                { headers: { Authorization: authHeader, "Content-Type": "application/json" } }
              );

              if (orderPaymentsRes.ok) {
                const orderPaymentsData = await orderPaymentsRes.json();
                // Find a captured or authorized payment
                const capturedPayment = orderPaymentsData.items?.find(
                  (p: any) => p.status === "captured" || p.status === "authorized"
                );
                if (capturedPayment) {
                  isPaid = true;
                  resolved_payment_id = capturedPayment.id; // The actual pay_... ID
                  payment_order_id = txId; // The order_... ID
                  console.log(`✅ Resolved payment ${capturedPayment.id} from order ${txId}`);
                  await logEvent("insert-new-order", "Payment Resolved", `pay=${capturedPayment.id} from order=${txId}`, "success");
                } else {
                  console.log(`⚠️ No captured payment for order ${txId}. Payments:`, JSON.stringify(orderPaymentsData));
                  await logEvent("insert-new-order", "Payment Not Captured", `No captured payment for ${txId}`, "error");
                }
              } else {
                const errText = await orderPaymentsRes.text();
                console.error(`❌ Razorpay API error for ${txId}:`, errText);
                await logEvent("insert-new-order", "Razorpay API Error", errText, "error");
              }

            } else {
              // Unknown prefix — treat as a generic reference, log it
              console.log(`⚠️ Unknown payment_transaction_id format: ${txId}`);
              await logEvent("insert-new-order", "Unknown Payment Format", txId, "error");
            }
          } catch (razorpayErr: any) {
            // Razorpay API call failed — log but DON'T crash
            console.error(`❌ Razorpay validation exception:`, razorpayErr);
            await logEvent("insert-new-order", "Razorpay Exception", razorpayErr.message || String(razorpayErr), "error");
          }

        } else if (!txId) {
          console.log("⚠️ No payment_transaction_id provided, skipping payment validation");
          await logEvent("insert-new-order", "Payment Skip", "No txId provided", "info");
        }

        if (!isPaid) {
          // If the order is requested as "pending", we ALLOW it to be inserted as pending.
          // This fixes the bug where WhatsApp orders are rejected *before* the customer pays, dropping the whole order.
          if (orderStatus === "pending") {
            console.log(`⚠️ Payment not yet captured for ${txId}, but orderStatus is pending. Allowing insertion as 'pending'.`);
            await logEvent("insert-new-order", "Payment Validated (Pending)", `Pending: ${txId}`, "info", body.order_id);
          } else {
            await logEvent("insert-new-order", "Payment Validation", `Payment not captured: ${txId}`, "error", body.order_id);
            return new Response(
              JSON.stringify({ error: "Payment not captured", payment_transaction_id: txId }),
              { status: 400, headers: corsHeaders }
            );
          }
        } else {
          await logEvent("insert-new-order", "Payment Validated", `Captured: ${resolved_payment_id || txId}`, "success", body.order_id);
        }
      }

      // --- Customer creation ---
      let newCustomerId = customer_id;

      if (customer_id) {
        const { data: existingCust } = await supabase
          .from("customers")
          .select("customer_id")
          .eq("customer_id", customer_id)
          .maybeSingle();

        if (!existingCust) {
          const { error: insertErr } = await supabase
            .from("customers")
            .insert([{
              customer_id: customer_id,
              full_name: customer_name,
              mobile_number: mobileNumber,
              address: address,
              state: state,
              email: email,
              pincode: pincode || null
            }]);
          if (insertErr) {
            await logEvent("insert-new-order", "Customer Creation", insertErr, "error", body.order_id);
            return new Response(
              JSON.stringify({ error: "Failed to create customer", details: insertErr }),
              { status: 500, headers: corsHeaders }
            );
          }
          await logEvent("insert-new-order", "Customer Created", `ID: ${customer_id}`, "success", body.order_id);
        }
      } else {
        // No customer_id provided — look up by mobile_number first, then create if not found
        let existingByMobile = null;
        if (mobileNumber) {
          const { data: foundCust } = await supabase
            .from("customers")
            .select("customer_id")
            .eq("mobile_number", String(mobileNumber))
            .maybeSingle();
          existingByMobile = foundCust;
        }

        if (existingByMobile) {
          // Customer already exists — reuse their ID
          newCustomerId = existingByMobile.customer_id;
          console.log(`✅ Existing customer found by mobile: ${newCustomerId}`);
          await logEvent("insert-new-order", "Existing Customer Found", `ID: ${newCustomerId}`, "success");
        } else {
          // No existing customer — create new
          const { data: custData, error: custErr } = await supabase
            .from("customers")
            .insert([{
              full_name: customer_name,
              mobile_number: mobileNumber,
              address: address,
              state: state,
              email: email,
              pincode: pincode || null
            }])
            .select("customer_id")
            .single();

          if (custErr || !custData) {
            await logEvent("insert-new-order", "Customer Creation", custErr, "error", body.order_id);
            return new Response(
              JSON.stringify({ error: "Failed to create customer", details: custErr }),
              { status: 500, headers: corsHeaders }
            );
          }
          newCustomerId = custData.customer_id;
          await logEvent("insert-new-order", "Guest Customer Created", `ID: ${newCustomerId}`, "success", body.order_id);
        }
      }

      // --- Order creation ---
      // ✅ FIX: Store original order_XXX in razorpay_order_id, store pay_XXX in payment_transaction_id
      // This ensures the webhook can find orders by EITHER field
      const finalPaymentTxId = resolved_payment_id || (txId && !txId.startsWith('order_') ? txId : null);
      const finalRazorpayOrderId = payment_order_id || (txId && txId.startsWith('order_') ? txId : null);

      const orderInsertPayload: any = {
        customer_id: newCustomerId,
        total_amount: correctedTotalAmount,
        shipping_amount,
        payment_method,
        payment_transaction_id: finalPaymentTxId || txId || null,
        payment_status: isPaid ? 'paid' : 'pending',
        source,
        order_note,
        order_status: orderStatus,
        shipping_address,
        shipping_state,
        shipping_pincode,
        contact_number,
        name,
      };

      // Always store razorpay_order_id if available
      if (finalRazorpayOrderId) {
        orderInsertPayload.razorpay_order_id = finalRazorpayOrderId;
      }

      if (body.order_id) orderInsertPayload.order_id = body.order_id;

      // First attempt with razorpay_order_id
      let orderData: any = null;
      let orderErr: any = null;

      const insertResult = await supabase
        .from("orders")
        .insert([orderInsertPayload])
        .select("order_id")
        .single();

      orderData = insertResult.data;
      orderErr = insertResult.error;

      // If insert failed because razorpay_order_id column doesn't exist, retry without it
      if (orderErr && orderErr.message?.includes('razorpay_order_id')) {
        console.warn("⚠️ razorpay_order_id column not found, retrying without it");
        delete orderInsertPayload.razorpay_order_id;
        const retryResult = await supabase
          .from("orders")
          .insert([orderInsertPayload])
          .select("order_id")
          .single();
        orderData = retryResult.data;
        orderErr = retryResult.error;
      }

      if (orderErr || !orderData) {
        if (!customer_id) {
          await supabase.from("customers").delete().eq("customer_id", newCustomerId);
          await logEvent("insert-new-order", "Customer Rollback", `Deleted: ${newCustomerId}`, "error");
        }
        await logEvent("insert-new-order", "Order Creation Failed", orderErr, "error", body.order_id);
        return new Response(
          JSON.stringify({ error: "Failed to insert order", details: orderErr }),
          { status: 500, headers: corsHeaders }
        );
      }
      await logEvent("insert-new-order", "Order Created", `ID: ${orderData.order_id}`, "success", orderData.order_id);

      // --- Attach Order IDs to Processed Order Items ---
      const finalOrderItems = resolvedOrderItems.map(item => ({
        ...item,
        order_id: orderData.order_id
      }));

      // --- Insert all order items ---
      const { error: insertItemsErr } = await supabase.from("order_items").insert(finalOrderItems);
      if (insertItemsErr) {
        await supabase.from("orders").delete().eq("order_id", orderData.order_id);
        if (!customer_id) {
          await supabase.from("customers").delete().eq("customer_id", newCustomerId);
        }
        await logEvent("insert-new-order", "Order Items Failed", insertItemsErr, "error", orderData.order_id);
        return new Response(JSON.stringify({ error: "Failed to insert order_items", details: insertItemsErr }), { status: 500, headers: corsHeaders });
      }
      await logEvent("insert-new-order", "Order Items Inserted", `${finalOrderItems.length} items`, "success", orderData.order_id);

      // --- Shipment tracking ---
      if (orderStatus !== "failed") {
        const { error: trackingErr } = await supabase.from("shipment_tracking").insert([{
          order_id: orderData.order_id,
          shipping_status: "Yet to Ship",
          created_at: new Date().toISOString()
        }]);
        if (trackingErr) {
          // Don't rollback the entire order for tracking failure — it can be added later
          console.error("⚠️ Shipment tracking insert failed (non-critical):", trackingErr);
          await logEvent("insert-new-order", "Shipment Tracking Failed", trackingErr, "error", orderData.order_id);
        } else {
          await logEvent("insert-new-order", "Shipment Tracking Created", orderData.order_id, "success", orderData.order_id);
        }
      }

      // --- Email notification (non-blocking) ---
      let orderItemsData: any = null;
      try {
        const { data } = await supabase
          .from("order_items")
          .select(`
            quantity,
            is_combo,
            product_variants!inner (
              sku,
              variant_name,
              saleprice
            )
          `)
          .eq("order_id", orderData.order_id);

        orderItemsData = data;

        // Build items table rows
        let itemsTableRows = "";
        let itemTotal = 0;
        for (const item of orderItemsData ?? []) {
          const pv = (item as any).product_variants;
          if (pv) {
            const lineTotal = (pv.saleprice || 0) * item.quantity;
            itemTotal += lineTotal;
            itemsTableRows += `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f0f0f0;">${pv.variant_name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; text-align: center;">${pv.sku}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; text-align: center;">${item.quantity}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; text-align: right;">₹${pv.saleprice}</td>
              </tr>`;
          }
        }

        const paymentBadge = isPaid
          ? '<span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px;">✅ Paid</span>'
          : '<span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px;">⏳ Pending</span>';

        const orderConfirmationHtml = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #E91E63, #AD1457); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Rajashree Fashion</h1>
              <p style="color: #fce4ec; margin: 5px 0 0;">Order Confirmation</p>
            </div>
            
            <!-- Body -->
            <div style="padding: 30px; border: 1px solid #f0f0f0; border-top: none;">
              <p style="font-size: 16px;">Hi <strong>${customer_name || 'Customer'}</strong>,</p>
              <p>Thank you for your order! Here are your order details:</p>
              
              <!-- Order Info -->
              <div style="background: #fdf2f8; border-radius: 10px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 5px 0;"><strong>Order ID:</strong></td>
                    <td style="text-align: right; color: #E91E63; font-weight: bold;">${orderData.order_id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Payment:</strong></td>
                    <td style="text-align: right;">${paymentBadge}</td>
                  </tr>
                  <tr>
                    <td style="padding: 5px 0;"><strong>Total Amount:</strong></td>
                    <td style="text-align: right; font-size: 18px; font-weight: bold;">₹${total_amount}</td>
                  </tr>
                </table>
              </div>
              
              <!-- Items Table -->
              <h3 style="color: #333; border-bottom: 2px solid #E91E63; padding-bottom: 8px;">Items Ordered</h3>
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background: #fdf2f8;">
                    <th style="padding: 10px; text-align: left;">Product</th>
                    <th style="padding: 10px; text-align: center;">SKU</th>
                    <th style="padding: 10px; text-align: center;">Qty</th>
                    <th style="padding: 10px; text-align: right;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsTableRows}
                </tbody>
              </table>
              
              ${shipping_address ? `
              <h3 style="color: #333; border-bottom: 2px solid #E91E63; padding-bottom: 8px;">Shipping Address</h3>
              <p style="background: #f8f8f8; padding: 15px; border-radius: 8px; line-height: 1.6;">
                ${name || customer_name}<br>
                ${shipping_address}<br>
                ${shipping_state} - ${shipping_pincode}<br>
                📞 ${contact_number || mobileNumber}
              </p>
              ` : ''}
              
              <p style="margin-top: 25px;">We'll notify you once your shipment is on the way! 🚚</p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
              <p style="text-align: center; color: #999; font-size: 12px;">
                © ${new Date().getFullYear()} Rajashree Fashion. All rights reserved.<br>
                <a href="https://rajashreefashion.com" style="color: #E91E63;">rajashreefashion.com</a>
              </p>
            </div>
          </div>
        `;

        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          // Build recipient list: customer email + admin
          const recipients: string[] = ["malathy@foxindia.org"];
          if (email && email !== "malathy@foxindia.org") {
            recipients.unshift(email); // Customer email first
          }

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              from: "Rajashree Fashion <noreply@rajashreefashion.com>",
              to: recipients,
              subject: `Order Confirmed: #${orderData.order_id} — Rajashree Fashion`,
              html: orderConfirmationHtml
            })
          });
          await logEvent("insert-new-order", "Email Sent", `To: ${recipients.join(', ')}`, "success", orderData.order_id);
        }
      } catch (emailErr: any) {
        // Email failure must NEVER block order creation
        console.error("⚠️ Email failed (non-critical):", emailErr?.message || emailErr);
      }

      // --- Google Sheets Backup Webhook (Non-blocking) ---
      try {
        const GOOGLE_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwIR5IbmoZTB5d-3Lya-_EGBJGBHwVuyY-Z1ZQe0gwJX5E-7ABeFhg1yPef445V-la71g/exec";

        let readableItemsString = "Unknown Items";
        try {
          // Attempt to build a beautiful human-readable string if the email data fetch succeeded
          if (typeof orderItemsData !== 'undefined' && orderItemsData) {
            readableItemsString = (orderItemsData as any[]).map((i: any) => {
              const pv = i.product_variants;
              return pv ? `${pv.variant_name} [${pv.sku}] (x${i.quantity})` : `Item ID: ${i.catalogue_product_id}`;
            }).join(" | ");
          } else {
            // Fallback to raw DB format
            readableItemsString = finalOrderItems.map((i: any) => `Variant: ${i.catalogue_product_id} (x${i.quantity})`).join(" | ");
          }
        } catch (e) { console.error("Could not map readable string", e); }

        await fetch(GOOGLE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" }, // Bypass CORS preflight heavily enforced by Google Apps Script
          body: JSON.stringify({
            order_id: orderData.order_id,
            customer_name: name || customer_name || "Guest",
            mobile: contact_number || mobileNumber || "N/A",
            amount: total_amount,
            source: source || "WhatsApp",
            status: orderStatus || "Pending",
            payment_id: txId || payment_transaction_id || "N/A",
            items: readableItemsString
          })
        });
        await logEvent("insert-new-order", "Google Sheet Backup Fired", orderData.order_id, "success");
      } catch (sheetsErr) {
        console.error("⚠️ Google Sheets Webhook failed (non-critical):", sheetsErr);
      }

      return new Response(JSON.stringify({
        message: "Order placed successfully",
        order_id: orderData.order_id,
        customer_id: newCustomerId
      }), { status: 200, headers: corsHeaders });

    } else {
      await logEvent("insert-new-order", "Order Skipped", `Status: ${orderStatus}`, "info");
      return new Response(JSON.stringify({ error: `Skipped Order of Status ${orderStatus}` }), { status: 200, headers: corsHeaders });
    }
  } catch (err: any) {
    console.error("❌ insert-new-order CRITICAL ERROR:", err);
    await logEvent("insert-new-order", "Critical Error", err?.message || String(err), "error");
    return new Response(JSON.stringify({ error: "Internal error", details: err?.message || String(err) }), { status: 500, headers: corsHeaders });
  }
});
