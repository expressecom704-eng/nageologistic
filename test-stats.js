import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function computeStats() {
  const { data: orderData, error } = await supabase.from('orders').select('*');
  
  const realizableOrders = orderData.filter(o => o.status === 'Delivered' && o.payment_status === 'Paid');
  const revenue = realizableOrders.reduce((sum, o) => sum + (Number(o.total_value) || 0), 0);
  const deliveryFees = realizableOrders.reduce((sum, o) => sum + (Number(o.delivery_cost) || 0), 0);

  console.log(`Total Orders: ${orderData.length}`);
  console.log(`Delivered+Paid Orders: ${realizableOrders.length}`);
  console.log(`Computed Revenue: ${revenue}`);
  console.log(`Computed Delivery Fees: ${deliveryFees}`);

  const paidOnly = orderData.filter(o => o.payment_status === 'Paid');
  const deliveredOnly = orderData.filter(o => o.status === 'Delivered');
  console.log(`Only Paid: ${paidOnly.length}, Only Delivered: ${deliveredOnly.length}`);
}

computeStats();
