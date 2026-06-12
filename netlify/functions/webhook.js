const { createCode, expiryFor } = require("./utils/codes");
const { sendActivationEmail } = require("./utils/email");
const { createServiceClient } = require("./utils/supabase");

/**
 * Map Stripe price IDs and metadata to plan types
 * New business model: invest, plus, care
 * Legacy: monthly, annual, lifetime
 */
function getPlanType(metadata, priceId) {
  // First check metadata from checkout session
  if (metadata?.plan) {
    const plan = metadata.plan;
    // Map plan keys to simplified plan types
    if (plan.includes('invest')) return 'invest';
    if (plan.includes('plus')) return 'plus';
    if (plan.includes('care')) return 'care';
    return plan; // Return as-is for legacy plans
  }
  // Fallback: determine from price ID (if needed in future)
  return metadata?.product || 'sentinelai';
}

/**
 * Determine product name from plan type
 */
function getProductName(planType) {
  const products = {
    invest: 'sentinel-invest',
    plus: 'sentinel-plus',
    care: 'sentinel-care',
    monthly: 'sentinelai',
    annual: 'sentinelai',
    lifetime: 'sentinelai'
  };
  return products[planType] || planType;
}

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

  // Handle checkout completion
  if (stripeEvent.type === "checkout.session.completed") {
    const metadata = object.metadata || {};
    const planType = getPlanType(metadata);
    const product = getProductName(planType);
    const email = object.customer_details?.email || object.customer_email;
    
    if (!email) return { statusCode: 400, body: "Checkout email is missing" };
    
    // Check for duplicates
    const existingQuery = object.payment_intent
      ? supabase.from("activation_codes").select("id").eq("stripe_payment_intent_id", object.payment_intent)
      : supabase.from("activation_codes").select("id").eq("stripe_subscription_id", object.subscription);
    const { data: existing } = await existingQuery.maybeSingle();
    if (existing) return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
    
    const expiresAt = expiryFor(planType);
    
    // Create activation code
    const code = await createCode(supabase, { 
      type: planType, 
      product, 
      email, 
      stripeSubId: object.subscription, 
      stripeCustomerId: object.customer, 
      stripePaymentIntentId: object.payment_intent, 
      expiresAt, 
      notes: `Stripe checkout ${object.id}` 
    });
    
    // Insert subscription record with new plan type
    await supabase.from("subscriptions").insert({ 
      email, 
      stripe_customer_id: object.customer, 
      stripe_subscription_id: object.subscription, 
      plan: planType,  // Stores: invest, plus, care, monthly, annual, lifetime
      status: "active", 
      current_period_end: expiresAt, 
      activation_code_id: code.id,
      metadata: { 
        founding_member: metadata.founding_member === "true",
        checkout_session_id: object.id
      }
    });
    
    await supabase.from("code_generation_log").insert({ code_id: code.id, generated_by: "stripe_webhook" });
    await sendActivationEmail({ to: email, code: code.code, plan: planType, product, expiresAt });
  }

  // Handle subscription cancellation
  if (stripeEvent.type === "customer.subscription.deleted") {
    await supabase.from("activation_codes").update({ status: "cancelled" }).eq("stripe_subscription_id", object.id);
    await supabase.from("subscriptions").update({ status: "cancelled" }).eq("stripe_subscription_id", object.id);
  }

  // Handle subscription updates
  if (stripeEvent.type === "customer.subscription.updated") {
    const newStatus = object.status;
    const expiresAt = expiryFor(null, object.current_period_end);
    await supabase.from("activation_codes").update({ 
      status: newStatus === "active" ? "active" : newStatus,
      expires_at: expiresAt 
    }).eq("stripe_subscription_id", object.id);
    await supabase.from("subscriptions").update({ 
      status: newStatus,
      current_period_end: expiresAt 
    }).eq("stripe_subscription_id", object.id);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
