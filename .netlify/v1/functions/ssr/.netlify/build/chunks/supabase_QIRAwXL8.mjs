import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://placeholder.supabase.co";
const supabaseAnonKey = "placeholder-key";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase as s };
