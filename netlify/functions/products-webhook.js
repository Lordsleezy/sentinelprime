<<<<<<< HEAD
const { createCode } = require("./utils/codes");
const { sendProductActivationEmail } = require("./utils/email");
const { createServiceClient } = require("./utils/supabase");

exports.handler = async (event) => {
  // Validate Stripe configuration
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { statusCode: 503, body: "Webhook is not configured" };
  }

  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  let stripeEvent;

=======
const { createCode, expiryFor } = require("./utils/codes");
const { sendActivationEmail } = require("./utils/email");
const { createServiceClient } = require("./utils/supabase");

const PRODUCT_PLAN_MAP = {
  shift: "lifetime",
  shield: "annual",
  care: "monthly",
  sentinelai: "monthly"
};

exports.handler = async (event) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRODUCTS_WEBHOOK_SECRET) {
    return { statusCode: 503, body: "Products webhook is not configured" };
  }
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  let stripeEvent;
>>>>>>> 03fbd81f212c54a9639bca42da4adeeb613e4a23
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      event.headers["stripe-signature"],
<<<<<<< HEAD
      process.env.STRIPE_WEBHOOK_SECRET
=======
      process.env.STRIPE_PRODUCTS_WEBHOOK_SECRET
>>>>>>> 03fbd81f212c54a9639bca42da4adeeb613e4a23
    );
  } catch (error) {
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }

  const supabase = createServiceClient();
  const object = stripeEvent.data.object;

<<<<<<< HEAD
  // Handle checkout completion for Shield and Shift products
  if (stripeEvent.type === "checkout.session.completed") {
    const product = object.metadata?.product;
    const email = object.customer_details?.email || object.customer_email;

    // Only process Shield and Shift products here
    if (!product || !['shield', 'shift'].includes(product)) {
      return { statusCode: 200, body: JSON.stringify({ received: true, product, handled: false }) };
    }

    if (!email) {
      return { statusCode: 400, body: "Checkout email is missing" };
    }

    // Check for duplicate (idempotency)
    const existingQuery = object.payment_intent
      ? supabase.from("activation_codes").select("id").eq("stripe_payment_intent_id", object.payment_intent)
      : supabase.from("activation_codes").select("id").eq("stripe_subscription_id", object.subscription);

    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) {
      return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
    }

    // Generate activation code for the product
    const code = await createCode(supabase, {
      product,
      type: "lifetime",
      email,
      stripePaymentIntentId: object.payment_intent,
      stripeCustomerId: object.customer,
      stripeSubscriptionId: object.subscription,
      notes: `Stripe checkout ${object.id} for ${product}`
    });

    // Log the generation
    await supabase.from("code_generation_log").insert({
      code_id: code.id,
      generated_by: "products_webhook",
      product,
      notes: `Auto-generated for ${product} purchase`
    });

    // Send activation email
    await sendProductActivationEmail({
      to: email,
      code: code.code,
      product,
      productName: product === 'shield' ? 'Sentinel Shield' : 'Shift by Sentinel'
    });

    return { statusCode: 200, body: JSON.stringify({ received: true, code: code.code }) };
  }

  // Handle subscription cancellation
  if (stripeEvent.type === "customer.subscription.deleted") {
    await supabase
      .from("activation_codes")
      .update({ status: "cancelled" })
      .eq("stripe_subscription_id", object.id);
=======
  if (stripeEvent.type === "checkout.session.completed") {
    const product = object.metadata?.product;
    if (!product || product === "sentinelai") {
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

    await supabase.from("code_generation_log").insert({ code_id: code.id, generated_by: "products_webhook" });
    await sendActivationEmail({ to: email, code: code.code, plan: type, product, expiresAt });
  }

  if (stripeEvent.type === "customer.subscription.deleted") {
    await supabase.from("activation_codes").update({ status: "cancelled" }).eq("stripe_subscription_id", object.id);
>>>>>>> 03fbd81f212c54a9639bca42da4adeeb613e4a23
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
