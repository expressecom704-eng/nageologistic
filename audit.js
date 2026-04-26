import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function systemAudit() {
  console.log("=== NAGEO MANAGEMENT SYSTEM AUDIT ===");
  
  // Check Orders
  const { data: orders } = await supabase.from('orders').select('*');
  console.log(`Orders found: ${orders?.length || 0}`);
  const delivered = orders?.filter(o => o.status === 'Delivered') || [];
  console.log(`Delivered Orders: ${delivered.length}`);

  // Check Transactions
  const { data: tx, error: txError } = await supabase.from('transactions').select('*');
  if (txError) {
    console.log(`Transactions Read Error: ${txError.message}`);
  } else {
    console.log(`Transactions found: ${tx?.length || 0}`);
    tx?.forEach(t => {
      console.log(`- TX: ${t.id} | Status: ${t.status} | Amount: ${t.amount} | Earnings: ${t.agent_earnings}`);
    });
  }

  // Check Logs RLS
  const { data: logs, error: logsError } = await supabase.from('logs').select('*').limit(1);
  if (logsError) {
    console.log(`Logs Read Error: ${logsError.message}`);
  } else {
    console.log("Logs table accessible.");
  }
}

systemAudit();
