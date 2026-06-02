const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { json, method, parseBody } = require("./utils/http");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { email, password } = parseBody(event);
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH) return json(503, { error: "Admin login is not configured yet." });
  let passwordHash = process.env.ADMIN_PASSWORD_HASH;
  try {
    const { data } = await createServiceClient().from("admin_password_overrides").select("password_hash").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data?.password_hash) passwordHash = data.password_hash;
  } catch {}
  if (String(email).toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase() || !(await bcrypt.compare(password || "", passwordHash))) {
    return json(401, { error: "Invalid credentials" });
  }
  try {
    const token = crypto.randomBytes(32).toString("hex");
    await createServiceClient().from("admin_sessions").insert({ session_token: token, expires_at: new Date(Date.now() + 86400000).toISOString() });
    return json(200, { success: true }, { "Set-Cookie": `admin_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/` });
  } catch {
    return json(503, { error: "Admin database is not configured yet." });
  }
};

