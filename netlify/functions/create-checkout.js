const { json, method, parseBody } = require("./utils/http");

exports.handler = async (event) => {
  if (!method(event, ["POST"])) return json(405, { error: "Method not allowed" });
  const { plan, email, product } = parseBody(event);
  const prices = { monthly: process.env.STRIPE_PRICE_MONTHLY, annual: process.env.STRIPE_PRICE_ANNUAL, lifetime: process.env.STRIPE_PRICE_LIFETIME };
  const carePrices = { monthly: process.env.STRIPE_PRICE_CARE_MONTHLY, annual: process.env.STRIPE_PRICE_CARE_ANNUAL };
  const priceMap = product === "care" ? carePrices : prices;
  if (!email) return json(400, { error: "Email is required for activation-code delivery." });
  if (!process.env.STRIPE_SECRET_KEY || !priceMap[plan]) return json(503, { error: "Checkout is not configured yet." });
  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: plan === "lifetime" ? "payment" : "subscription",
      line_items: [{ price: priceMap[plan], quantity: 1 }],
      customer_email: email || undefined,
      success_url: `${process.env.SITE_URL || "https://sentinelprime.org"}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: product === "care" ? `${process.env.SITE_URL || "https://sentinelprime.org"}/care` : `${process.env.SITE_URL || "https://sentinelprime.org"}/products`,
      metadata: { plan, product: product || "care" },
      allow_promotion_codes: true
    });
    return json(200, { url: session.url });
  } catch (error) {
    return json(500, { error: error.message });
  }
};
