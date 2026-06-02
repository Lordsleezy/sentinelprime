const crypto = require("crypto");

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TYPES = ["monthly", "annual", "lifetime", "gift", "admin"];

function generateCode() {
  const segments = [];
  for (let segment = 0; segment < 3; segment += 1) {
    let value = "";
    for (let index = 0; index < 4; index += 1) {
      value += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
    }
    segments.push(value);
  }
  return `SNTL-${segments.join("-")}`;
}

function expiryFor(type, unixSeconds) {
  if (unixSeconds) return new Date(unixSeconds * 1000).toISOString();
  if (type === "monthly") return new Date(Date.now() + 31 * 86400000).toISOString();
  if (type === "annual") return new Date(Date.now() + 366 * 86400000).toISOString();
  return null;
}

async function createCode(supabase, values) {
  if (!CODE_TYPES.includes(values.type)) throw new Error("Invalid activation-code type");
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const code = generateCode();
    const { data, error } = await supabase
      .from("activation_codes")
      .insert({
        code,
        type: values.type,
        status: "unused",
        email: values.email?.toLowerCase() || null,
        user_id: values.userId || null,
        stripe_subscription_id: values.stripeSubId || null,
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

module.exports = { CODE_TYPES, createCode, expiryFor, generateCode };

