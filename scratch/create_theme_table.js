const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    // Step 1: Create the table using raw SQL via supabase-js
    // supabase-js doesn't have a raw SQL endpoint, so we create
    // the table by trying to insert and handling errors,
    // OR we use the REST API directly.

    // Actually, let's use the Supabase Management API SQL endpoint
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    theme_tokens jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
`;

    // Use the SQL endpoint  
    const response = await fetch(`${url}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({ query: sql })
    });

    // If we can't use rpc, let's try pg_net or just use the Supabase SQL editor approach
    // Actually, let's check if the table exists first
    const { data, error } = await supabase.from('theme_settings').select('id').limit(1);
    
    if (error && error.code === '42P01') {
        console.log('Table does not exist. Need to create it via Supabase Dashboard SQL editor.');
        console.log('');
        console.log('Run this SQL in the Supabase Dashboard SQL editor:');
        console.log(sql);
        
        // Alternative: try creating via postgrest's rpc if there's a function
        console.log('');
        console.log('Alternatively, trying to create via pg_dump approach...');
        
        // We'll try using a workaround - create via the built-in pg functions
        // Unfortunately, service_role can't run DDL via PostgREST.
        // The only way is via the Management API or SQL editor.
        
        // Let's try creating the table data directly by creating a migration  
        // via the Supabase Management API
        const projectRef = 'gvsorguincvinuiqtooo';
        const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
        
        const mgmtResponse = await fetch(managementUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({ query: sql })
        });
        
        console.log('Management API response status:', mgmtResponse.status);
        const mgmtBody = await mgmtResponse.text();
        console.log('Management API response:', mgmtBody);
    } else if (error) {
        console.log('Other error:', error);
    } else {
        console.log('Table already exists! Data:', data);
    }
}

run().catch(console.error);
