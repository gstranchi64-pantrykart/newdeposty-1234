import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://bgxnmmecjcgrwtemmjtz.supabase.co';
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_J6X_PIGF2pyciaHA3o_okg_HHaCulEU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const supabaseConfig = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  projectRef: 'bgxnmmecjcgrwtemmjtz',
  dbUrl: 'postgresql://postgres:[YOUR-PASSWORD]@db.bgxnmmecjcgrwtemmjtz.supabase.co:5432/postgres',
};
