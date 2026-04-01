import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

    try {
        const body = await req.json();

        /* -----------------------------
           1️⃣ INPUT TYPE DETECTION
        ------------------------------*/
        const input = body.input ?? "";
        let detected_type: "text" | "image" | "unknown" = "unknown";

        if (typeof input === "string") {
            const lower = input.toLowerCase();
            if (
                lower.startsWith("http") &&
                /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/.test(lower)
            ) {
                detected_type = "image";
            } else {
                detected_type = "text";
            }
        }

        /* -----------------------------
           2️⃣ ADDRESS BUILDING (SAFE)
           (Libromi-approved approach)
        ------------------------------*/
        const addressParts = [
            body.house_no_english,
            body.delivery_street_english,
            body.delivery_city_english,
            body.delivery_district_english,
            body.pincode_english,
            body.state_english,
        ]
            .map((v: string) => (typeof v === "string" ? v.trim() : ""))
            .filter(Boolean);

        const delivery_address_english =
            addressParts.length > 0 ? addressParts.join(", ") : null;

        /* -----------------------------
           3️⃣ RESPONSE
        ------------------------------*/
        return new Response(
            JSON.stringify({
                detected_type,
                delivery_address_english,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                },
            }
        );
    } catch (err: any) {
        return new Response(
            JSON.stringify({
                error: err.message || "Invalid request",
            }),
            {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders,
                },
            }
        );
    }
});
