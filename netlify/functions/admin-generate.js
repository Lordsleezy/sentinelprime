const { createCode, expiryFor } = require("./utils/codes");
const { sendActivationEmail } = require("./utils/email");
const { json, method, parseBody } = require("./utils/http");
const { verifyAdminSession } = require("./utils/admin");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  try {
    if (!(await verifyAdminSession(event))) return json(401, { error: "Unauthorized" });
    const { type, email, notes } = parseBody(event);
    if (!["monthly", "annual", "lifetime", "gift", "admin"].includes(type)) return json(400, { error: "Invalid type" });
    const supabase = createServiceClient();
    const expiresAt = expiryFor(type);
    const code = await createCode(supabase, { type, email, expiresAt, notes: notes || "Admin generated" });
    await supabase.from("code_generation_log").insert({ code_id: code.id, generated_by: "admin", notes: notes || null });
    if (email) await sendActivationEmail({ to: email, code: code.code, plan: type, expiresAt });
    return json(200, { code: code.code, type, email: email || null, expires_at: expiresAt });
  } catch {
    return json(503, { error: "Admin generator is not configured yet." });
  }
};

