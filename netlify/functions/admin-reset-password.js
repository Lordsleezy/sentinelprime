const bcrypt = require("bcryptjs");
const { json, method, parseBody } = require("./utils/http");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { token, password } = parseBody(event);
  if (!token || !password || String(password).length < 12) return json(400, { error: "A valid token and a password of at least 12 characters are required." });
  try {
    const supabase = createServiceClient();
    const sessionToken = `reset_${token}`;
    const { data } = await supabase.from("admin_sessions").select("id").eq("session_token", sessionToken).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!data) return json(401, { error: "Reset link is invalid or expired." });
    await supabase.from("admin_password_overrides").insert({ password_hash: await bcrypt.hash(password, 12) });
    await supabase.from("admin_sessions").delete().eq("id", data.id);
    return json(200, { ok: true });
  } catch {
    return json(503, { error: "Admin reset is not configured yet." });
  }
};
