import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepTestUpdate() {
  console.log("Authenticating as original Master Admin (+10000000000)...");
  
  // NOTE: the password for the dummy user was likely something arbitrary or '123456'
  const { data: auth, error: loginError } = await supabase.auth.signInWithPassword({
    phone: '+10000000000',
    password: 'password123' // or whatever it was
  });

  if (loginError) {
    console.error("Login Failed for original Master Admin. Trying a different approach.");
    // Let's just fetch the order to see who it is assigned to.
    const { data: ord } = await supabase.from('orders').select('*').limit(1);
    console.log("Order 1 Assigned To:", ord[0]?.assigned_to);
    return;
  }
}

deepTestUpdate();
