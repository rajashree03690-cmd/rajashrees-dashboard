import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseClient(req: Request) {
    // Clean the auth header (e.g. remove trailing spaces)
    const authHeader = req.headers.get('authorization')?.trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''

    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: authHeader ? { authorization: authHeader } : {},
        },
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    })
}

export function getAdminClient() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    return createClient(supabaseUrl, supabaseServiceKey)
}
