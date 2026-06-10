const crypto = require("crypto");

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TYPES = ["monthly", "annual", "lifetime", "gift", "admin"];
const PRODUCT_TYPES = ["sentinelai", "shift", "shield", "care", "earn"];

function generateCode(product) {
  const segments = [];
  for (let segment = 0; segment < 4; segment += 1) {
    let value = "";
    for (let index = 0; index < 4; index += 1) {
      value += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
    }
    segments.push(value);
  }
  // Format: XXXX-XXXX-XXXX-XXXX (uppercase alphanumeric)
  // Or with prefix for specific products
  const prefix = product && product !== 'sentinelai' ? product.toUpperCase().substring(0, 4) : '';
  return prefix ? `${prefix}-${segments.join("-")}` : segments.join("-");
}

function expiryFor(type, unixSeconds) {
  if (unixSeconds) return new Date(unixSeconds * 1000).toISOString();
  if (type === "monthly") return new Date(Date.now() + 31 * 86400000).toISOString();
  if (type === "annual") return new Date(Date.now() + 366 * 86400000).toISOString();
  return null;
}

async function createCode(supabase, values) {
  const type = values.type || "lifetime";
  const product = values.product || "sentinelai";

  if (!CODE_TYPES.includes(type)) throw new Error("Invalid activation-code type");
  if (!PRODUCT_TYPES.includes(product)) throw new Error("Invalid product");
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const code = generateCode(product);
    const { data, error } = await supabase
      .from("activation_codes")
      .insert({
        code,
        product,
        type,
        status: "unused",
        email: values.email?.toLowerCase() || null,
        user_id: values.userId || null,
        stripe_subscription_id: values.stripeSubId || values.stripeSubscriptionId || null,
        stripe_customer_id: values.stripeCustomerId || null,
        stripe_payment_intent_id: values.stripePaymentIntentId || null,
        expires_at: values.expiresAt || null,
        notes: values.notes || null
      })
      .select()
      .single();
    if (!error) return data;
    if (error.code !== "23505") throw new Error(`Code creation failed: ${error.message}`);
  }
  throw new Error("Unable to create a unique activation code");
}

module.exports = { CODE_TYPES, PRODUCT_TYPES, createCode, expiryFor, generateCode };

