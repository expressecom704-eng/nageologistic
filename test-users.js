import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminStatus() {
  const { data, error } = await supabase.from('users').select('*');
  console.log("All DB Users:", data);
}

checkAdminStatus();
