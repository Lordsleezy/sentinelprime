const { json, method } = require("./utils/http");
const { createServiceClient, userFromEvent } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["GET"])) return json(405, { error: "Method not allowed" });
  try {
    const user = await userFromEvent(event);
    if (!user) return json(401, { authenticated: false });
    const supabase = createServiceClient();
    const [{ data: codes }, { data: subscriptions }] = await Promise.all([
      supabase.from("activation_codes").select("code,type,status,expires_at,created_at").or(`user_id.eq.${user.id},email.eq.${user.email}`).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*").or(`user_id.eq.${user.id},email.eq.${user.email}`).order("created_at", { ascending: false })
    ]);
    return json(200, { authenticated: true, user: { id: user.id, email: user.email }, codes: codes || [], subscriptions: subscriptions || [] });
  } catch {
    return json(503, { authenticated: false, error: "Account service is not configured yet." });
  }
};

