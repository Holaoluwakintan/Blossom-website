import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://rlbrhpjljjgpqpqjrpkc.supabase.co";
const supabaseAnonKey = "sb_publishable_NT2VXfEUwWEEdcuft2VdDA_9DXSaMq4";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabase as s };
