require('dotenv').config({ path: '.env.local' });

async function test() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delhivery`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'calculate_cost',
      payload: {
        origin_pin: '636002',
        destination_pin: '600001',
        weight: 500,
        mode: 'S'
      }
    })
  });
  console.log('Status', response.status);
  const data = await response.json();
  const fs = require('fs');
  fs.writeFileSync('delhivery_cost_test.json', JSON.stringify(data, null, 2));
  console.log('Result saved to delhivery_cost_test.json');
}
test();
