const { json, method, parseBody } = require("./utils/http");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { valid: false, reason: "Method not allowed" });
  const { code } = parseBody(event);
  if (!code) return json(400, { valid: false, reason: "No code provided" });
  try {
    const supabase = createServiceClient();
    const normalized = String(code).toUpperCase().trim();
    const { data, error } = await supabase.from("activation_codes").select("*").eq("code", normalized).maybeSingle();
    if (error || !data) return json(200, { valid: false, reason: "Code not found" });
    if (["revoked", "cancelled", "expired"].includes(data.status)) return json(200, { valid: false, reason: `Code ${data.status}` });
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await supabase.from("activation_codes").update({ status: "expired" }).eq("id", data.id);
      return json(200, { valid: false, reason: "Subscription expired" });
    }
    const now = new Date().toISOString();
    await supabase.from("activation_codes").update({
      status: "active",
      last_validated_at: now,
      activated_at: data.activated_at || now
    }).eq("id", data.id);
    return json(200, { valid: true, type: data.type, plan: data.type, expires_at: data.expires_at, email: data.email });
  } catch (error) {
    return json(503, { valid: false, reason: "Activation service is not configured" });
  }
};

