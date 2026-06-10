const { createCode, expiryFor } = require("./utils/codes");
const { sendActivationEmail } = require("./utils/email");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return { statusCode: 503, body: "Webhook is not configured" };
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, event.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }
  const supabase = createServiceClient();
  const object = stripeEvent.data.object;
  if (stripeEvent.type === "checkout.session.completed") {
    const type = object.metadata?.plan || (object.mode === "payment" ? "lifetime" : "monthly");
    const product = object.metadata?.product || "sentinelai";
    const email = object.customer_details?.email || object.customer_email;
    if (!email) return { statusCode: 400, body: "Checkout email is missing" };
    const expiresAt = expiryFor(type);
    const existingQuery = object.payment_intent
      ? supabase.from("activation_codes").select("id").eq("stripe_payment_intent_id", object.payment_intent)
      : supabase.from("activation_codes").select("id").eq("stripe_subscription_id", object.subscription);
    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
    const code = await createCode(supabase, { type, product, email, stripeSubId: object.subscription, stripeCustomerId: object.customer, stripePaymentIntentId: object.payment_intent, expiresAt, notes: `Stripe checkout ${object.id}` });
    await supabase.from("subscriptions").insert({ email, stripe_customer_id: object.customer, stripe_subscription_id: object.subscription, plan: type, status: "active", current_period_end: expiresAt, activation_code_id: code.id });
    await supabase.from("code_generation_log").insert({ code_id: code.id, generated_by: "stripe_webhook" });
    await sendActivationEmail({ to: email, code: code.code, plan: type, product, expiresAt });
  }
  if (stripeEvent.type === "customer.subscription.deleted") await supabase.from("activation_codes").update({ status: "cancelled" }).eq("stripe_subscription_id", object.id);
  if (stripeEvent.type === "customer.subscription.updated") await supabase.from("activation_codes").update({ status: "active", expires_at: expiryFor(null, object.current_period_end) }).eq("stripe_subscription_id", object.id);
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
