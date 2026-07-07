const account = require("./account_store");

const PLANS = {
  care_monthly: {
    label: "Care Monthly",
    mode: "subscription",
    envPrice: "STRIPE_PRICE_CARE_MONTHLY",
    fallbackAmount: 1999,
    interval: "month",
    product: "care",
  },
  care_annual: {
    label: "Care Annual",
    mode: "subscription",
    envPrice: "STRIPE_PRICE_CARE_ANNUAL",
    fallbackAmount: 14900,
    interval: "year",
    product: "care",
  },
  guardian_annual: {
    label: "Guardian Annual",
    mode: "subscription",
    envPrice: "STRIPE_PRICE_GUARDIAN_ANNUAL",
    fallbackAmount: 1999,
    interval: "year",
    product: "guardian",
  },
  linux_lifetime: {
    label: "Shift Lifetime",
    mode: "payment",
    envPrice: "STRIPE_PRICE_LINUX_LIFETIME",
    fallbackAmount: 2900,
    product: "linux",
  },
};

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return require("stripe")(process.env.STRIPE_SECRET_KEY);
}

function planConfig(planId) {
  const p = PLANS[planId];
  if (!p) throw new Error(`Invalid plan: ${planId}`);
  return p;
}

async function createCheckoutSession({ plan, email, userId, successUrl, cancelUrl }) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");
  const cfg = planConfig(plan);
  const em = (email || "").trim().toLowerCase();
  const base = process.env.PUBLIC_BASE_URL || "http://localhost:3000";

  const metadata = {
    plan,
    product: cfg.product,
    email: em,
    user_id: userId || "",
  };

  const priceId = process.env[cfg.envPrice];
  const lineItems = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [{
        price_data: {
          currency: "usd",
          recurring: cfg.mode === "subscription" ? { interval: cfg.interval } : undefined,
          product_data: { name: cfg.label },
          unit_amount: cfg.fallbackAmount,
        },
        quantity: 1,
      }];

  const session = await stripe.checkout.sessions.create({
    mode: cfg.mode,
    customer_email: em || undefined,
    line_items: lineItems,
    success_url: successUrl || `${base}/products`,
    cancel_url: cancelUrl || `${base}/products`,
    metadata,
    subscription_data:
      cfg.mode === "subscription"
        ? { metadata }
        : undefined,
  });

  return { sessionId: session.id, url: session.url };
}

async function handleWebhookEvent(event) {
  const stripe = getStripe();
  const type = event.type;
  const obj = event.data.object;

  if (type === "checkout.session.completed") {
    const session = obj;
    const plan = session.metadata?.plan || "care_monthly";
    const email = session.customer_email || session.metadata?.email;
    let userId = session.metadata?.user_id || (await account.resolveUserIdForEmail(email));

    if (!userId && email) {
      userId = await account.resolveUserIdForEmail(email);
    }

    const licenseKey = await account.createLicense({ userId, email, plan });

    if (session.mode === "subscription" && session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      await account.syncSubscription({
        userId,
        email,
        plan,
        status: sub.status,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
      });
    }

    await account.recordPayment({
      userId,
      amountCents: session.amount_total || planConfig(plan).fallbackAmount,
      plan,
      status: "paid",
      stripePaymentIntent: session.payment_intent,
    });

    return { handled: true, licenseKey, email, plan };
  }

  return { handled: false };
}

module.exports = { PLANS, createCheckoutSession, handleWebhookEvent, getStripe };
