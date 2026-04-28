import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTransactions() {
  console.log("Checking transactions table:");
  const { data, error } = await supabase.from('transactions').select('*');
  if (error) {
    console.error("Does not exist or error:", error.message);
  } else {
    console.log("Transactions data:", data);
  }
}

checkTransactions();
