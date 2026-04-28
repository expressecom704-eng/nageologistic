import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Anon Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  console.log("Checking Database connection to:", supabaseUrl);
  
  // Try to query the custom 'products' table we created in the schema
  const { data: products, error: productError } = await supabase.from('products').select('*').limit(1);
  
  if (productError) {
    if (productError.code === '42P01') {
      console.log("ERROR: Tables do not exist! The SQL Schema has not been executed yet.");
    } else {
      console.log("ERROR querying products:", productError.message);
    }
    return;
  }
  
  // Try querying 'orders'
  const { data: orders, error: orderError } = await supabase.from('orders').select('*').limit(1);
  if (orderError) {
    console.log("ERROR querying orders:", orderError.message);
    return;
  }
  
  console.log("SUCCESS! All custom tables are created and the database is fully functional.");
}

checkDatabase();
