import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepTestUpdate() {
  console.log("Authenticating as Admin to bypass RLS...");
  const { data: auth, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'expressecom704@gmail.com',
    password: 'Blessed@7.,.'
  });

  if (loginError) {
    console.error("Login Failed:", loginError);
    return;
  }
  
  console.log("Logged in! Executing UPDATE orders SET status = 'Delivered'...");
  const { data, error } = await supabase.from('orders').update({ status: 'Delivered' }).eq('code', 'ORD-20260420-7188').select();
  
  if (error) {
    console.error("\n❌ Hard PostgreSQL Exception Caught:");
    console.error(error.message, error.details, error.hint);
  } else {
    console.log("\n✅ Success! Postgres accepted the status update:", data);
  }
}

deepTestUpdate();
