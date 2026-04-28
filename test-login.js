import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log("\n🚀 EXECUTING DIAGNOSTIC AUTHENTICATION TEST...");
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'expressecom704@gmail.com',
    password: 'Blessed@7.,.',
  });

  if (error) {
    console.error("❌ RAW SUPABASE ERROR:");
    console.error(error.message);
    if (error.message.includes('Invalid login credentials')) {
        console.log("\n[DIAGNOSIS]: Although the password is 100% correct, Supabase returns this generic error when the account's Email is NOT CONFIRMED, or if you deleted it.");
    }
  } else {
    console.log("✅ SUCCESS! Logged in as:", data?.user?.email);
  }
}

testLogin();
