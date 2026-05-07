import { createClient } from '@supabase/supabase-js';

// These should normally be in .env, using simple placeholders for the project skeleton
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xjdvajrlegyyqljqijvm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_vN90zdea5smRqWTPQlTvDA_NUuR9t6o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
