import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use the direct Supabase URL for all client-side connections.
// Previously used a /supabase-proxy via Vercel rewrites, but Vercel rewrites
// only work for HTTP — they CANNOT proxy WebSocket connections, causing
// Realtime subscription 500 errors. Direct URL works for both REST and WebSocket.

// Singleton client instance (fixes "Multiple GoTrueClient instances" warning)
let _supabase: ReturnType<typeof createClient> | null = null;

export const supabase = (() => {
    if (!_supabase) {
        _supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false, // Dashboard uses custom auth, not Supabase Auth
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
            realtime: {
                params: {
                    eventsPerSecond: 2,
                },
            },
        });
    }
    return _supabase;
})();

// For server-side operations (API routes that need service role)
export function createServerClient() {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(supabaseUrl, supabaseServiceKey);
}
