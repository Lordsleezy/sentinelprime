const { json, method, parseBody } = require("./utils/http");
const { createAnonClient } = require("./utils/supabase");

function sessionCookie(token, maxAge = 3600) {
  return `sentinel_access_token=${encodeURIComponent(token || "")}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
}

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { action, email, password, full_name } = parseBody(event);
  try {
    const supabase = createAnonClient();
    if (action === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name } } });
      if (error) return json(400, { error: error.message });
      return json(200, { ok: true, confirmationRequired: !data.session });
    }
    if (action === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return json(401, { error: "Invalid email or password" });
      return json(200, { ok: true }, { "Set-Cookie": sessionCookie(data.session.access_token, data.session.expires_in) });
    }
    if (action === "forgot") {
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.SITE_URL || "https://sentinelprime.org"}/login?reset=1` });
      return json(200, { ok: true });
    }
    if (action === "logout") return json(200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
    return json(400, { error: "Invalid action" });
  } catch {
    return json(503, { error: "Account service is not configured yet." });
  }
};

