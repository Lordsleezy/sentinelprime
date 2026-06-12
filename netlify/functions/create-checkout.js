const { json, method, parseBody } = require("./utils/http");

/**
 * NEW BUSINESS MODEL - Price ID mapping
 * invest: Sentinel Invest $9.99/mo
 * plus: Sentinel Plus bundle ($19.99/mo or $149/yr)
 * care-*: One-time Care add-ons
 * Legacy: Old SentinelAI plans (archived)
 */
const PRICE_MAP = {
  // New business model - Subscriptions
  invest_monthly: process.env.STRIPE_PRICE_INVEST_MONTHLY,
  plus_monthly: process.env.STRIPE_PRICE_PLUS_MONTHLY,
  plus_annual: process.env.STRIPE_PRICE_PLUS_ANNUAL,
  // Care add-ons - One-time payments
  care_remote_member: process.env.STRIPE_PRICE_CARE_REMOTE_MEMBER,
  care_remote_nonmember: process.env.STRIPE_PRICE_CARE_REMOTE_NONMEMBER,
  care_phone_nonmember: process.env.STRIPE_PRICE_CARE_PHONE_NONMEMBER,
  // Legacy (for backward compatibility)
  monthly: process.env.STRIPE_PRICE_MONTHLY,
  annual: process.env.STRIPE_PRICE_ANNUAL,
  lifetime: process.env.STRIPE_PRICE_LIFETIME,
};

/**
 * Plan configuration for mode determination
 */
const PLAN_CONFIG = {
  invest_monthly: { mode: "subscription", product: "invest" },
  plus_monthly: { mode: "subscription", product: "plus" },
  plus_annual: { mode: "subscription", product: "plus" },
  care_remote_member: { mode: "payment", product: "care" },
  care_remote_nonmember: { mode: "payment", product: "care" },
  care_phone_nonmember: { mode: "payment", product: "care" },
  monthly: { mode: "subscription", product: "sentinelai", legacy: true },
  annual: { mode: "subscription", product: "sentinelai", legacy: true },
  lifetime: { mode: "payment", product: "sentinelai", legacy: true },
};

function getPlanKey(product, plan) {
  // Map product+plan combinations to price map keys
  const mapping = {
    "invest:monthly": "invest_monthly",
    "invest:annual": "invest_monthly", // Only monthly for Invest
    "plus:monthly": "plus_monthly",
    "plus:annual": "plus_annual",
    "care-remote-member:onetime": "care_remote_member",
    "care-remote-nonmember:onetime": "care_remote_nonmember",
    "care-phone-nonmember:onetime": "care_phone_nonmember",
    // Legacy mappings
    "sentinelai:monthly": "monthly",
    "sentinelai:annual": "annual",
    "sentinelai:lifetime": "lifetime",
  };
  return mapping[`${product}:${plan}`] || plan;
}

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  
  const { product, plan, email } = parseBody(event);
  
  if (!email) return json(400, { error: "Email is required for subscription." });
  if (!product || !plan) return json(400, { error: "Product and plan are required." });
  if (!process.env.STRIPE_SECRET_KEY) return json(503, { error: "Stripe is not configured." });
  
  const planKey = getPlanKey(product, plan);
  const priceId = PRICE_MAP[planKey];
  const config = PLAN_CONFIG[planKey];
  
  if (!priceId || !config) {
    return json(503, { error: `Checkout not configured for ${product} ${plan}. Price ID not found.` });
  }
  
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    
    const sessionConfig = {
      mode: config.mode,
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: `${process.env.SITE_URL || "https://sentinelprime.org"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL || "https://sentinelprime.org"}/pricing`,
      metadata: { 
        plan: planKey, 
        product: config.product,
        founding_member: "true" // Tag for founding member pricing
      },
      allow_promotion_codes: true
    };
    
    // Add subscription data for subscription mode
    if (config.mode === "subscription") {
      sessionConfig.subscription_data = {
        metadata: { 
          plan: planKey, 
          product: config.product,
          founding_member: "true"
        }
      };
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig);
    return json(200, { url: session.url, plan: planKey, product: config.product });
  } catch (error) {
    console.error("Checkout error:", error);
    return json(500, { error: error.message });
  }
};
