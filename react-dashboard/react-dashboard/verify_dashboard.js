
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDashboard() {
    console.log('Testing get_daily_sales_stats...');
    const { data, error } = await supabase.rpc('get_daily_sales_stats', {
        p_target_date: new Date().toISOString().split('T')[0],
        p_dsource_filter: 'All'
    });

    if (error) {
        console.error('❌ Error calling get_daily_sales_stats:', error.message);
        console.error('Hint:', error.hint);
        console.error('Details:', error.details);
    } else {
        console.log('✅ get_daily_sales_stats success:', data);
    }

    console.log('\nTesting get_weekly_sales_stats...');
    const { data: weekly, error: weeklyError } = await supabase.rpc('get_weekly_sales_stats', {
        p_target_date: new Date().toISOString().split('T')[0]
    });

    if (weeklyError) {
        console.error('❌ Error calling get_weekly_sales_stats:', weeklyError.message);
    } else {
        console.log('✅ get_weekly_sales_stats success:', weekly);
    }
}

testDashboard();
