import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRealData() {
  const { data: orderData } = await supabase.from('orders').select('*');
  console.log("Raw Database Orders:");
  orderData?.forEach(o => {
    console.log(`- [${o.code}] Status: '${o.status}' | Paid: '${o.payment_status}' | Goods: ${o.total_value} | Delivery: ${o.delivery_cost}`);
  });

  const realizableOrders = orderData.filter(o => o.status === 'Delivered' && o.payment_status === 'Paid');
  console.log(`\nFiltered realizable: ${realizableOrders.length}`);
  const rRev = realizableOrders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0);
  const rDel = realizableOrders.reduce((sum, o) => sum + (Number(o.delivery_cost) || 0), 0);
  console.log(`Math -> Revenue: ${rRev}, Delivery: ${rDel}`);
}

checkRealData();
