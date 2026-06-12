/**
 * Stripe Checkout — monthly, annual, lifetime + webhook sync to account store.
 */
const account = require("./account_store");

const PLANS = {
  // NEW BUSINESS MODEL - Subscriptions
  invest_monthly: {
    label: "Invest Monthly",
    mode: "subscription",
    envPrice: "STRIPE_PRICE_INVEST_MONTHLY",
    fallbackAmount: 999,
    interval: "month",
    product: "invest",
  },
  plus_monthly: {
    label: "Plus Monthly",
    mode: "subscription",
    envPrice: "STRIPE_PRICE_PLUS_MONTHLY",
    fallbackAmount: 1999,
    interval: "month",
    product: "plus",
  },
  plus_annual: {
    label: "Plus Annual",
    mode: "subscription",
    envPrice: "STRIPE_PRICE_PLUS_ANNUAL",
    fallbackAmount: 14900,
    interval: "year",
    product: "plus",
  },
  // Care add-ons - One-time payments
  care_remote_member: {
    label: "Care Remote - Member",
    mode: "payment",
    envPrice: "STRIPE_PRICE_CARE_REMOTE_MEMBER",
    fallbackAmount: 4000,
    product: "care",
  },
  care_remote_nonmember: {
    label: "Care Remote - Non-Member",
    mode: "payment",
    envPrice: "STRIPE_PRICE_CARE_REMOTE_NONMEMBER",
    fallbackAmount: 10000,
    product: "care",
  },
  care_phone_nonmember: {
    label: "Care Phone - Non-Member",
    mode: "payment",
    envPrice: "STRIPE_PRICE_CARE_PHONE_NONMEMBER",
    fallbackAmount: 1000,
    product: "care",
  },
  // LEGACY - Keep for backward compatibility during migration
  monthly: {
    label: "Monthly (Legacy)",
    mode: "subscription",
    envPrice: "STRIPE_PRICE_MONTHLY",
    fallbackAmount: 1999,
    interval: "month",
    legacy: true,
  },
  annual: {
    label: "Annual (Legacy)",
    mode: "subscription",
    envPrice: "STRIPE_PRICE_ANNUAL",
    fallbackAmount: 19900,
    interval: "year",
    legacy: true,
  },
  lifetime: {
    label: "Lifetime (Legacy)",
    mode: "payment",
    envPrice: "STRIPE_PRICE_LIFETIME",
    fallbackAmount: 49900,
    legacy: true,
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
    email: em,
    user_id: userId || "",
  };

  let priceId = process.env[cfg.envPrice];
  const lineItems = [];

  if (priceId) {
    lineItems.push({ price: priceId, quantity: 1 });
  } else if (cfg.mode === "subscription") {
    lineItems.push({
      price_data: {
        currency: "usd",
        recurring: { interval: cfg.interval },
        product_data: { name: `SentinelAI Pro (${cfg.label})` },
        unit_amount: cfg.fallbackAmount,
      },
      quantity: 1,
    });
  } else {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "SentinelAI Pro (Lifetime)" },
        unit_amount: cfg.fallbackAmount,
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: cfg.mode,
    customer_email: em || undefined,
    line_items: lineItems,
    success_url: successUrl || `${base}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${base}/pricing.html`,
    metadata,
    subscription_data:
      cfg.mode === "subscription"
        ? { metadata: { plan, email: em, user_id: userId || "" } }
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
    const plan = session.metadata?.plan || "lifetime";
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
    } else {
      await account.syncSubscription({
        userId,
        email,
        plan: "lifetime",
        status: "active",
        stripeCustomerId: session.customer,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
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

  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const sub = obj;
    const plan = sub.metadata?.plan || "monthly";
    const email = sub.metadata?.email;
    const userId = sub.metadata?.user_id || (await account.resolveUserIdForEmail(email));
    await account.syncSubscription({
      userId,
      email,
      plan,
      status: sub.status,
      stripeCustomerId: sub.customer,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null,
    });
    return { handled: true };
  }

  if (type === "invoice.payment_succeeded") {
    const inv = obj;
    const email = inv.customer_email;
    const userId = await account.resolveUserIdForEmail(email);
    await account.recordPayment({
      userId,
      amountCents: inv.amount_paid,
      plan: inv.lines?.data?.[0]?.metadata?.plan || "monthly",
      status: "paid",
      stripeInvoiceId: inv.id,
    });
    return { handled: true };
  }

  if (type === "payment_intent.succeeded") {
    const intent = obj;
    const email = intent.receipt_email || intent.metadata?.email;
    const plan = intent.metadata?.plan || "lifetime";
    if (email && !intent.metadata?.checkout_handled) {
      const userId = await account.resolveUserIdForEmail(email);
      const licenseKey = await account.createLicense({ userId, email, plan });
      return { handled: true, licenseKey, legacy: true };
    }
  }

  return { handled: false };
}

module.exports = { PLANS, createCheckoutSession, handleWebhookEvent, getStripe };
