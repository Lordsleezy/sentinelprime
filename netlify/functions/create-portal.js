const { json, method, parseBody } = require("./utils/http");
const { createServiceClient, userFromEvent } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  if (!process.env.STRIPE_SECRET_KEY) return json(503, { error: "Billing portal is not configured yet." });
  const { customer_id } = parseBody(event);
  if (!customer_id) return json(400, { error: "Customer ID required" });
  try {
    const user = await userFromEvent(event);
    if (!user) return json(401, { error: "Login required" });
    const { data: subscription } = await createServiceClient().from("subscriptions").select("id").eq("stripe_customer_id", customer_id).or(`user_id.eq.${user.id},email.eq.${user.email}`).limit(1).maybeSingle();
    if (!subscription) return json(403, { error: "Billing account not found" });
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({ customer: customer_id, return_url: `${process.env.SITE_URL || "https://sentinelprime.org"}/account` });
    return json(200, { url: session.url });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
