import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1?target=deno";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Helper function to sanitize text for PDF (remove unsupported characters)
function sanitizeText(text: string): string {
    if (!text) return '';
    // Remove Tamil and other unsupported Unicode characters
    // Keep only ASCII printable characters, spaces, and common punctuation
    return text
        .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
}

// Tamil text renderer
async function renderTamilText(text: string) {
    const encoded = encodeURIComponent(text);
    const url = `https://quickchart.io/graphviz?format=png&graph=digraph{a[label="${encoded}" fontsize=16 fontname="Noto Sans Tamil" shape=plaintext]}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Tamil image render failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}

// Barcode generator
async function generateBarcode(orderId: string) {
    const url = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(
        orderId
    )}&scale=2&height=10&includetext=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Barcode generation failed");
    return new Uint8Array(await res.arrayBuffer());
}

// Logo loader
async function loadLogo() {
    const { data, error } = await supabase.storage.from("fonts").download("rajashree-logo.png");
    if (error || !data) throw new Error("Logo download failed: " + error.message);
    return new Uint8Array(await data.arrayBuffer());
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const body = await req.json();
        const { order_id } = body;

        if (!order_id) {
            return new Response(JSON.stringify({ error: "Missing order_id" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`[Invoice Generator] Processing Order ID: ${order_id}`);

        // Fetch order data from database
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select(`
        *,
        customers (
          full_name, email, mobile_number, address, state, city, pincode
        ),
        order_items (
          quantity,
          catalogue_product_id,
          is_combo,
          product_variants (
            variant_name,
            sku,
            saleprice,
            regularprice,
            product_id,
            master_product (name)
          )
        )
      `)
            .eq('order_id', order_id)
            .single();

        if (orderError || !order) {
            throw new Error(`Order not found: ${orderError?.message}`);
        }

        // Prepare data
        const customer = order.customers || {};
        const orderId = String(order.order_id);
        const orderDate = order.created_at?.split("T")[0] || new Date().toISOString().split("T")[0];
        const customerName = customer.full_name || order.name || "Guest";
        const mobileNumber = customer.mobile_number || order.contact_number || "";
        const whatsappNumber = customer.mobile_number || order.contact_number || "";
        const shippingAddress = (order.shipping_address || customer.address || "")
            .replace(/\\n/g, "\n")
            .replace(/\\\sn/g, "\n")
            .replace(/\\\\n/g, "\n")
            .replace(/\s*\n\s*/g, "\n")
            .trim();
        const shipping_pincode = order.shipping_pincode || customer.pincode || "";
        const shippingState = order.shipping_state || customer.state || "";
        const shippingAmount = Number(order.shipping_amount || 0);

        // 🎯 FIX: Map items with combo support — fetch combo details from combo table
        const items: any[] = [];
        for (const item of (order.order_items || [])) {
            if (item.is_combo) {
                // Fetch combo details directly from the combo table
                const { data: comboData } = await supabase
                    .from('combo')
                    .select('name, sku, saleprice, regularprice')
                    .eq('combo_id', item.catalogue_product_id)
                    .maybeSingle();

                if (comboData) {
                    items.push({
                        product_name: comboData.name || "Combo",
                        variant_name: "",
                        sku: comboData.sku || "",
                        price: Number(comboData.saleprice || comboData.regularprice || 0),
                        quantity: item.quantity || 1,
                    });
                } else {
                    // Fallback: combo not found in DB, use whatever we have
                    console.warn(`⚠️ Combo ${item.catalogue_product_id} not found in combo table`);
                    items.push({
                        product_name: `Combo #${item.catalogue_product_id}`,
                        variant_name: "",
                        sku: "",
                        price: 0,
                        quantity: item.quantity || 1,
                    });
                }
            } else {
                const variant = item.product_variants || {};
                const master = variant.master_product || {};
                items.push({
                    product_name: master.name || "",
                    variant_name: variant.variant_name || "",
                    sku: variant.sku || "",
                    price: Number(variant.saleprice || variant.regularprice || 0),
                    quantity: item.quantity || 1,
                });
            }
        }

        // GST
        const totalGstRate = 3;
        const cgstRate = 1.5;
        const sgstRate = 1.5;
        const igstRate = 3.0;

        let subTotal = 0, cgst = 0, sgst = 0, igst = 0;

        for (const item of items) {
            const priceIncl = item.price || 0;
            const qty = item.quantity || 1;

            const lineTotalIncl = priceIncl * qty;
            const base = lineTotalIncl / (1 + totalGstRate / 100);
            const gstAmount = lineTotalIncl - base;

            subTotal += base;

            if (shippingState.trim().toLowerCase() === "tamil nadu") {
                cgst += gstAmount / 2;
                sgst += gstAmount / 2;
            } else {
                igst += gstAmount;
            }
        }

        const grandTotal = subTotal + cgst + sgst + igst + shippingAmount;

        // PDF setup
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const page = pdfDoc.addPage([595, 842]);
        const { width, height } = page.getSize();
        const black = rgb(0, 0, 0);
        const gray = rgb(0.7, 0.7, 0.7);

        let y = height - 30;

        // Logo
        try {
            const logoBytes = await loadLogo();
            const logoImg = await pdfDoc.embedPng(logoBytes);
            const scaledLogo = logoImg.scale(0.06);
            const logoY = y - scaledLogo.height + 20;

            page.drawImage(logoImg, {
                x: width - scaledLogo.width - 25,
                y: logoY,
                width: scaledLogo.width,
                height: scaledLogo.height,
            });
        } catch (e) {
            console.warn("⚠️ Logo missing:", e.message);
        }

        // Header - Enhanced Design
        page.drawText("Rajashree Fashion", { x: 30, y, size: 20, font, color: black });
        y -= 22;
        page.drawText("Chennai 600116, Tamil Nadu", { x: 30, y, size: 10, font, color: gray });
        y -= 14;
        page.drawText("Phone: 8056167040 | GSTIN: 33GFWPS8459J1Z8", { x: 30, y, size: 10, font, color: gray });
        y -= 10;

        // Thicker separator line
        page.drawLine({
            start: { x: 30, y },
            end: { x: width - 30, y },
            thickness: 2,
            color: rgb(0.8, 0.8, 0.8)
        });

        y -= 20;

        // Barcode
        const barcodeBytes = await generateBarcode(orderId);
        const barcodeImg = await pdfDoc.embedPng(barcodeBytes);
        const barcodeW = 160, barcodeH = 45;

        // Address - Clean Text Format
        page.drawText("To:", { x: 30, y, size: 13, font });
        y -= 22;

        // Process address
        const trimmedAddress = shippingAddress
            .replace(/\s*,\s*/g, "\n")
            .replace(/_/g, "\n")
            .split("\n")
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .join("\n");

        // Customer Name (Bold/larger)
        page.drawText(sanitizeText(customerName), { x: 50, y, size: 12, font });
        y -= 16;

        // Address lines (sanitize to remove unsupported characters)
        const addressLines = trimmedAddress.split("\n");
        for (const line of addressLines) {
            if (line.trim()) {
                page.drawText(sanitizeText(line.trim()), { x: 50, y, size: 10, font });
                y -= 14;
            }
        }

        // Pincode, State, City
        if (shipping_pincode) {
            page.drawText(sanitizeText(`Pincode: ${shipping_pincode}`), { x: 50, y, size: 10, font });
            y -= 14;
        }
        if (shippingState) {
            page.drawText(sanitizeText(`State: ${shippingState}`), { x: 50, y, size: 10, font });
            y -= 14;
        }

        // Contact Details
        if (mobileNumber) {
            page.drawText(sanitizeText(`Phone: ${mobileNumber}`), { x: 50, y, size: 10, font });
            y -= 14;
        }
        if (whatsappNumber && whatsappNumber !== mobileNumber) {
            page.drawText(sanitizeText(`WhatsApp: ${whatsappNumber}`), { x: 50, y, size: 10, font });
            y -= 14;
        }

        y -= 10;

        page.drawText(`Order Date: ${orderDate}`, { x: 30, y, size: 12, font });
        y -= 18;

        page.drawText(`Invoice No: ${orderId}`, { x: 30, y, size: 12, font });

        // Barcode
        page.drawImage(barcodeImg, {
            x: width - barcodeW - 85,
            y: y - barcodeH + 15,
            width: barcodeW,
            height: barcodeH,
        });

        y -= 60;

        // Product table header
        const colX = {
            product: 25,
            price: 275,
            qty: 375,
            total: 455
        };

        page.drawRectangle({
            x: 20,
            y: y - 20,
            width: width - 40,
            height: 22,
            color: rgb(0.90, 0.90, 0.90),
        });

        page.drawText("Product", { x: colX.product, y: y - 15, size: 11, font });
        page.drawText("Unit Price", { x: colX.price, y: y - 15, size: 11, font });
        page.drawText("Qty", { x: colX.qty, y: y - 15, size: 11, font });
        page.drawText("Total", { x: colX.total, y: y - 15, size: 11, font });

        y -= 25;

        // Product rows
        for (const item of items) {
            const price = item.price?.toFixed(2);
            const qty = item.quantity;
            const total = (item.price * qty).toFixed(2);

            const sku = item.sku ? String(item.sku).trim() : "";
            const productName = sanitizeText(item.product_name || "");
            const variantName = sanitizeText(item.variant_name || "");
            const raw = `${sku ? sku + " - " : ""}${productName} ${variantName}`.trim();

            function wrapText(text: string, maxChars: number) {
                const chars = Array.from(text);
                const lines = [];
                let current = [];

                for (let c of chars) {
                    current.push(c);
                    if (current.length >= maxChars && c === " ") {
                        lines.push(current.join("").trim());
                        current = [];
                    }
                }

                if (current.length > 0) lines.push(current.join("").trim());
                return lines.slice(0, 2);
            }

            const wrappedLines = wrapText(raw, 45);
            const lineHeight = 12;
            const rowHeight = 10 + (wrappedLines.length * lineHeight);

            page.drawRectangle({
                x: 20,
                y: y - rowHeight,
                width: width - 40,
                height: rowHeight,
                borderWidth: 0.5,
                borderColor: gray,
                color: rgb(1, 1, 1)
            });

            let lineY = y - 12;
            for (const line of wrappedLines) {
                page.drawText(sanitizeText(line), { x: colX.product, y: lineY, size: 10, font });
                lineY -= lineHeight;
            }

            page.drawText(`Rs.${price}`, { x: colX.price, y: y - 12, size: 10, font });
            page.drawText(`${qty}`, { x: colX.qty, y: y - 12, size: 10, font });
            page.drawText(`Rs.${total}`, { x: colX.total, y: y - 12, size: 10, font });

            y -= rowHeight;
        }

        y -= 25;

        // Totals
        const totals = [
            ["Subtotal", subTotal],
            ...(shippingState.trim().toLowerCase() === "tamil nadu"
                ? [[`CGST (${cgstRate}%)`, cgst], [`SGST (${sgstRate}%)`, sgst]]
                : [[`IGST (${igstRate}%)`, igst]]),
            ["Shipping", shippingAmount],
            ["Grand Total", grandTotal],
        ];

        for (const [label, value] of totals) {
            page.drawText(label, { x: 330, y, size: 11, font });
            page.drawText(`Rs.${Number(value).toFixed(2)}`, { x: 455, y, size: 11, font });
            y -= 15;
        }

        y -= 25;

        page.drawLine({
            start: { x: 20, y },
            end: { x: width - 20, y },
            thickness: 1,
            color: gray
        });

        y -= 20;

        page.drawText("Thank you for your purchase!", { x: 30, y, size: 11, font });
        y -= 14;

        page.drawText(
            "It is mandatory to take a 360 Degree parcel opening video after receiving your product from the courier.",
            { x: 30, y, size: 9, font }
        );

        page.drawText(
            "Without opening video the product will not be taken back for our consideration.",
            { x: 30, y: y - 12, size: 9, font }
        );

        // Save and upload
        const pdfBytes = await pdfDoc.save();
        const fileName = `Invoice_${orderId}_${Date.now()}.pdf`;

        const { error: uploadError } = await supabase
            .storage
            .from('invoices')
            .upload(fileName, pdfBytes, {
                contentType: 'application/pdf',
                upsert: true
            });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: { publicUrl } } = supabase
            .storage
            .from('invoices')
            .getPublicUrl(fileName);

        // Update database
        const { error: dbUpdateError } = await supabase
            .from('orders')
            .update({
                invoice_url: publicUrl,
                is_locked: true,
                invoice_number: orderId,
                invoice_generated_at: new Date().toISOString(),
            })
            .eq('order_id', order_id);

        if (dbUpdateError) throw new Error(`DB Update failed: ${dbUpdateError.message}`);

        return new Response(
            JSON.stringify({
                success: true,
                invoice_url: publicUrl,
                order_id: orderId
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (err) {
        console.error("❌ Error generating invoice:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
