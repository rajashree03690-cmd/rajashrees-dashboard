const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: dashboardUsers, error: dUserErr } = await supabase.from('dashboard_users').select('*').limit(1);
    console.log('dashboard_users:', dashboardUsers, dUserErr);
    
    // Instead of raw query which might not exist, let's just fetch all policies if we can,
    // or just assume RLS is the issue and use service_role to check!
}
run();
