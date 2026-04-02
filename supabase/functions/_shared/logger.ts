import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export async function logEvent(
    functionName: string,
    event: string,
    details: any,
    status: "success" | "error" | "info" = "info"
) {
    console.log(`[${status.toUpperCase()}] ${functionName} - ${event}:`, details);

    try {
        const { error } = await supabase.from("edge_function_logs").insert([
            {
                function_name: functionName,
                event_name: event,
                details: typeof details === "object" ? JSON.stringify(details) : String(details),
                status: status,
                created_at: new Date().toISOString(),
            },
        ]);

        if (error) console.error("Error saving log to DB:", error);
    } catch (err) {
        console.error("Failed to log event:", err);
    }
}
