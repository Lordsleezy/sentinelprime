const { json, method, parseBody } = require("./utils/http");
const { sendActivationEmail } = require("./utils/email");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { email } = parseBody(event);
  if (!email) return json(400, { error: "Email required" });
  const success = { message: "If a purchase was made with that email, the code has been resent." };
  try {
    const { data } = await createServiceClient().from("activation_codes").select("*").eq("email", String(email).toLowerCase()).in("status", ["unused", "active"]).order("created_at", { ascending: false }).limit(1);
    if (data?.[0]) await sendActivationEmail({ to: email, code: data[0].code, plan: data[0].type, expiresAt: data[0].expires_at, resent: true });
    return json(200, success);
  } catch {
    return json(503, { error: "Code recovery is not configured yet." });
  }
};

