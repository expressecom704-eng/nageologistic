import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdmin() {
  console.log("Authenticating as Admin to check DB...");
  const { data: auth, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'expressecom704@gmail.com',
    password: 'Blessed@7.,.'
  });

  if (loginError) {
    console.error("Login Failed:", loginError);
    return;
  }
  
  const uid = auth.user.id;
  console.log("Logged in! UID:", uid);
  
  const { data, error } = await supabase.from('users').select('*').eq('id', uid);
  if (error) {
    console.error("Error querying users table:", error);
  } else {
    console.log("User record in public.users:", data);
  }
}

checkAdmin();
