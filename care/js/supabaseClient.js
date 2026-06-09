import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { getPublicConfig } from './config.js';

let clientPromise;

export async function getSupabase() {
  if (!clientPromise) {
    clientPromise = getPublicConfig().then((config) => createClient(config.supabaseUrl, config.supabaseAnonKey));
  }
  return clientPromise;
}

export async function getSession() {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session;
}
