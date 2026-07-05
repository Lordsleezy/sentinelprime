const { createCode, expiryFor } = require("./utils/codes");
const { sendActivationEmail, sendProductActivationEmail } = require("./utils/email");
const { createServiceClient } = require("./utils/supabase");

const PRODUCT_PLAN_MAP = {
  linux: "lifetime",
  guardian: "annual",
  projects: "monthly",
  care: "monthly",
};

exports.handler = async (event) => {
  const webhookSecret = process.env.STRIPE_PRODUCTS_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    return { statusCode: 503, body: "Products webhook is not configured" };
  }

  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"],
      webhookSecret
    );
  } catch (error) {
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  const supabase = createServiceClient();
  const object = stripeEvent.data.object;

  if (stripeEvent.type === "checkout.session.completed") {
    const product = object.metadata?.product;
    if (!product) {
      return { statusCode: 200, body: JSON.stringify({ received: true, skipped: true }) };
    }

    const email = object.customer_details?.email || object.customer_email;
    if (!email) return { statusCode: 400, body: "Checkout email is missing" };

    const type = object.metadata?.plan || PRODUCT_PLAN_MAP[product] || "monthly";
    const expiresAt = expiryFor(type);
    const existingQuery = object.payment_intent
      ? supabase.from("activation_codes").select("id").eq("stripe_payment_intent_id", object.payment_intent)
      : supabase.from("activation_codes").select("id").eq("stripe_subscription_id", object.subscription);
    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };

    const code = await createCode(supabase, {
      type,
      product,
      email,
      stripeSubId: object.subscription,
      stripeCustomerId: object.customer,
      stripePaymentIntentId: object.payment_intent,
      expiresAt,
      notes: `Stripe product checkout ${object.id}`
    });

    await supabase.from("code_generation_log").insert({
      code_id: code.id,
      generated_by: "products_webhook",
      product,
      notes: `Auto-generated for ${product} purchase`
    });

    if (sendProductActivationEmail) {
      await sendProductActivationEmail({ to: email, code: code.code, product });
    } else {
      await sendActivationEmail({ to: email, code: code.code, plan: type, product, expiresAt });
    }
  }

  if (stripeEvent.type === "customer.subscription.deleted") {
    await supabase.from("activation_codes").update({ status: "cancelled" }).eq("stripe_subscription_id", object.id);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
