import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkStock() {
  const { data: prodData } = await supabase.from('products').select('*');
  console.log("Products in Stock:", prodData.map(p => ({ id: p.id, name: p.name, quantity: p.quantity })));
  
  const { data: orderItems } = await supabase.from('order_items').select('*');
  console.log("Order Items Attempting Deduction:", orderItems);
}

checkStock();
