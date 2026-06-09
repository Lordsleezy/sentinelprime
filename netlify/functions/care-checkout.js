const Stripe = require('stripe');
const { json } = require('./care-shared');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const { plan } = JSON.parse(event.body || '{}');
    const normalizedPlan = plan === 'plus' ? 'plus' : 'basic';
    const price = normalizedPlan === 'plus' ? process.env.STRIPE_PLUS_PRICE_ID : process.env.STRIPE_BASIC_PRICE_ID;
    if (!price) return json(400, { error: 'Stripe price ID is not configured.' });

    const siteUrl = process.env.SITE_URL || 'https://sentinelprime.org';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${siteUrl}/care/portal?checkout=success`,
      cancel_url: `${siteUrl}/care/checkout?plan=${normalizedPlan}&checkout=cancelled`,
      metadata: { plan: normalizedPlan, product: 'sentinel-care' },
      subscription_data: { metadata: { plan: normalizedPlan, product: 'sentinel-care' } }
    });

    return json(200, { url: session.url });
  } catch (error) {
    return json(400, { error: error.message });
  }
};
