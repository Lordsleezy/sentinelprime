const { cookie } = require("./http");
const { createServiceClient } = require("./supabase");

async function verifyAdminSession(event) {
  const token = cookie(event, "admin_token");
  if (!token) return false;
  const { data } = await createServiceClient()
    .from("admin_sessions")
    .select("id, expires_at")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return Boolean(data);
}

module.exports = { verifyAdminSession };

