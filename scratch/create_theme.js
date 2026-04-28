const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
CREATE TABLE IF NOT EXISTS public.theme_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid,
    theme_mode text DEFAULT 'system' CHECK (theme_mode IN ('light', 'dark', 'system')),
    primary_color text DEFAULT '#7c3aed',
    secondary_color text DEFAULT '#a855f7',
    sidebar_bg text DEFAULT 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    sidebar_text text DEFAULT '#ffffff',
    font_family text DEFAULT 'Inter',
    border_radius text DEFAULT '8px',
    theme_tokens jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Basic RLS for theme settings
ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to theme_settings" ON public.theme_settings FOR SELECT USING (true);
CREATE POLICY "Allow all access to theme_settings for authenticated" ON public.theme_settings FOR ALL USING (auth.role() = 'authenticated');
`;

async function run() {
    // If the rpc 'query_raw' doesn't exist, we can't do this from node.
    // Let's insert a default row directly to at least make the 404 go away IF the table exists.
    // Wait, the table DOES NOT EXIST. The query via RPC might fail if there's no query_raw function.
}
run();
