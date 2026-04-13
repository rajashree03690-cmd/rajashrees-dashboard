import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkLogs() {
    const { data, error } = await supabase
        .from("edge_function_logs")
        .select("*")
        .limit(100)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching logs:", error);
        return;
    }

    const filtered = data.filter((log: any) => {
        const logStr = typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details);
        return logStr.includes("WA004582") || logStr.includes("4582") || logStr.includes("plink_") || log.function_name === "insert-whatsapp-order";
    });

    if (filtered.length > 0) {
        console.log(`Found ${filtered.length} relevant logs:`);
        filtered.slice(0, 50).forEach((l: any) => {
            console.log(`\n[${l.created_at}] ${l.function_name} - ${l.event_name}`);
            const logStr = typeof l.details === 'object' ? JSON.stringify(l.details, null, 2) : String(l.details);
            console.log(logStr.substring(0, 1000));
        });
    } else {
        console.log("No specific logs found. Printing latest 5 logs instead:");
        data.slice(0, 5).forEach((l: any) => {
            console.log(`\n[${l.created_at}] ${l.function_name} - ${l.event_name}`);
            const logStr = typeof l.details === 'object' ? JSON.stringify(l.details) : String(l.details);
            console.log(logStr.substring(0, 200));
        });
    }
}

checkLogs();
