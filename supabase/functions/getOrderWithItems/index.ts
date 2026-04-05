import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { searchParams } = new URL(req.url);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    // === Check if single order fetch ===
    const orderId = searchParams.get("orderId");

    if (orderId) {
      // === SINGLE ORDER WITH ITEMS ===
       const { data: order, error: orderErr } = await supabase
        .from("orders")
         .select(`
    *,
    customers(customer_id, full_name, email, mobile_number, address, pincode,state)
  `)
  .eq("order_id", orderId)
  .maybeSingle();


      if (orderErr || !order) {
        return new Response(JSON.stringify({ error: "Order not found", details: orderErr }), {
          status: 404,
          headers,
        });
      }

      // Fetch all order items for the order
      const { data: rawItems, error: itemsErr } = await supabase
        .from("order_items")
        .select(`*, product_variants(sku,variant_name, saleprice)`) // always join product info
        .eq("order_id", orderId);

      if (itemsErr) {
        return new Response(JSON.stringify({ error: "Failed to fetch order items", details: itemsErr }), {
          status: 500,
          headers,
        });
      }

      // If any item is a combo, fetch combo and combo_items
      const comboItemIds = rawItems.filter((item) => item.is_combo).map((item) => item.combo_id);

      let comboDetails = [];
      if (comboItemIds.length > 0) {
        const { data: combos, error: comboErr } = await supabase
          .from("combo")
          .select("*, combo_items(variant_id)")
          .in("combo_id", comboItemIds);

        if (!comboErr && combos) {
          comboDetails = combos;
        }
      }

      // Attach combo details to relevant items
      const items = rawItems.map((item) => {
        if (item.is_combo) {
          const combo = comboDetails.find((c) => c.combo_id === item.combo_id);
          return { ...item, combo };
        }
        return item;
      });

      return new Response(JSON.stringify({ order, items }), { status: 200, headers });
    }

    // === Otherwise: MULTIPLE ORDERS WITH SHIPMENT ===
    const page = parseInt(searchParams.get("page") || "1", 10);
   const limit = parseInt(searchParams.get("limit") || "3000", 10);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const search = searchParams.get("search");
    const status = searchParams.get("status");

    let query = supabase
      .from("orders")
      .select(
        `
        *,
    customers(customer_id, full_name, email, mobile_number, address, pincode,state),
        shipment_tracking(
          shipping_status,
          delivered_date
        )
      `,
        { count: "exact" }
      )
      .order("order_id", { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `order_id.ilike.%${search}%,customer_name.ilike.%${search}%`
      );
    }

    if (status) {
      query = query.eq("order_status", status);
    }

    const { data: orders, error: allOrdersErr, count } = await query;

    if (allOrdersErr) {
      await logEvent("Order Validation", "Items are required", "error");
      return new Response(
        JSON.stringify({
          error: "Failed to fetch orders",
          details: allOrdersErr,
        }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({
        orders,
        total: count,
        page,
        limit,
      }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: err.message,
      }),
      { status: 500, headers }
    );
  }
});
