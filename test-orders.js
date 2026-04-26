import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrders() {
  console.log("Fetching orders from database...");
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5);

  if (error) {
    console.error("Error fetching orders:", error.message);
    return;
  }

  if (data.length === 0) {
    console.log("No orders found in database.");
    return;
  }

  console.log("Top 5 Recent Orders:");
  data.forEach((o, i) => {
    console.log(`\n[Order ${i + 1}] ID: ${o.id}`);
    console.log(`  Code: ${o.code}`);
    console.log(`  Status: '${o.status}'`);
    console.log(`  Payment Status: '${o.payment_status}'`);
    console.log(`  Total Value: ${o.total_value} (Type: ${typeof o.total_value})`);
    console.log(`  Delivery Cost: ${o.delivery_cost} (Type: ${typeof o.delivery_cost})`);
  });
}

checkOrders();
