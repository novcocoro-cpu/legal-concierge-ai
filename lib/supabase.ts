import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// サーバーサイド（API Route）用 — モジュールキャッシュを使わず毎回生成
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
