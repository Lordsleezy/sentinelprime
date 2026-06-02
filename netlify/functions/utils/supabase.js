const { createClient } = require("@supabase/supabase-js");

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

function createServiceClient() {
  if (!configured()) throw new Error("Supabase is not configured");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function createAnonClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("Supabase is not configured");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function userFromEvent(event) {
  const token = require("./http").cookie(event, "sentinel_access_token");
  if (!token || !configured()) return null;
  const { data, error } = await createServiceClient().auth.getUser(token);
  return error ? null : data.user;
}

module.exports = { configured, createServiceClient, createAnonClient, userFromEvent };

