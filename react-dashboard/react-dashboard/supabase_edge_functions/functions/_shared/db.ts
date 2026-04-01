import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getSupabaseClient(req: Request) {
    const authHeader = req.headers.get('authorization')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: authHeader ? { authorization: authHeader } : {},
        },
    })
}

export function getAdminClient() {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    return createClient(supabaseUrl, supabaseServiceKey)
}
