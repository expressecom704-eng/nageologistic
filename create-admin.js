import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseKey = 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  console.log("Registering admin credentials...");

  const { data, error } = await supabase.auth.signUp({
    email: 'expressecom704@gmail.com',
    password: 'Blessed@7.,.',
  });

  if (error) {
    if (error.message.includes("already registered")) {
        console.log("Account is already registered!");
    } else {
        console.log("Failed:", error.message);
    }
  } else {
    console.log("Successfully created user ID:", data?.user?.id);
  }
}

createAdmin();
