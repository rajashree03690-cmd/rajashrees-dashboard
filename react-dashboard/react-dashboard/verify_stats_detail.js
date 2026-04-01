
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyStats() {
    const today = '2026-01-25'; // Fixed date to match user's context/system time if needed, or use dynamic
    // Actually, user's screenshot has various dates. Let's use the date of the LAST order seen in screenshot: Jan 21, 2026.
    // If we query for Jan 21, 2026, we should see daily stats match.

    console.log('--- Verifying Daily Stats for 2026-01-21 (Known Order Date) ---');
    const { data: daily, error: dailyError } = await supabase.rpc('get_daily_sales_stats', {
        p_target_date: '2026-01-21',
        p_dsource_filter: 'All'
    });

    if (dailyError) console.error('Daily Error:', dailyError);
    else console.log('Daily Data (2026-01-21):', daily);

    console.log('\n--- Verifying Weekly Stats for Week of 2026-01-25 ---');
    // Week should include Jan 21 if week starts Jan 19.
    const { data: weekly, error: weeklyError } = await supabase.rpc('get_weekly_sales_stats', {
        p_target_date: '2026-01-25'
    });

    if (weeklyError) console.error('Weekly Error:', weeklyError);
    else {
        console.log('Weekly Data (Rows):', weekly?.length);
        if (weekly) {
            weekly.forEach(day => {
                if (day.total_sales > 0 || day.order_count > 0) {
                    console.log(`FOUND DATA: ${day.week_start} - Sales: ${day.total_sales}, Orders: ${day.order_count}`);
                }
            });
        }
    }
}

verifyStats();
