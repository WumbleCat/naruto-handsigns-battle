import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { SUPABASE_ANON_KEY, SUPABASE_CONFIGURED, SUPABASE_URL } from './env';

export type AppSupabaseClient = SupabaseClient<Database>;

/**
 * The one Supabase client. Null when the environment variables are missing, so the app still
 * boots and the auth layer can explain what is wrong instead of crashing.
 */
export const supabase: AppSupabaseClient | null = SUPABASE_CONFIGURED
  ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
