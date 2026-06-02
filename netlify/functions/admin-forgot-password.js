const crypto = require("crypto");
const { sendEmail } = require("./utils/email");
const { json, method, parseBody } = require("./utils/http");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { email } = parseBody(event);
  const ok = json(200, { sent: true });
  if (!process.env.ADMIN_EMAIL || String(email).toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase()) return ok;
  try {
    const token = crypto.randomBytes(32).toString("hex");
    await createServiceClient().from("admin_sessions").insert({ session_token: `reset_${token}`, expires_at: new Date(Date.now() + 3600000).toISOString() });
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: "Sentinel Admin - Password Reset",
      html: `<div style="background:#000;color:#fff;font-family:monospace;padding:40px"><h2 style="color:#00d4ff">Password Reset</h2><p>This reset link expires in one hour.</p><a style="color:#00d4ff" href="${process.env.SITE_URL || "https://sentinelprime.org"}/admin.html?reset=${token}">Reset Password</a></div>`
    });
    return ok;
  } catch {
    return ok;
  }
};

