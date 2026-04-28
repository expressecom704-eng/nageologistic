import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  console.log("Attempting to explicitly force Status update to 'Delivered' and checking for Postgres Trigger Check Constraint errors...");
  
  // Try to update Order 1 (ORD-20260420-7188)
  const { data, error } = await supabase.from('orders').update({ status: 'Delivered', payment_status: 'Paid' }).eq('code', 'ORD-20260420-7188').select();
  
  if (error) {
    console.error("\n❌ FATAL DATABASE ERROR ON UPDATE:");
    console.error(error);
  } else {
    console.log("\n✅ Update succeeded:", data);
  }
}

testUpdate();
