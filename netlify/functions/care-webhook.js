const Stripe = require('stripe');
const { getAdminSupabase, json } = require('./care-shared');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

exports.handler = async function handler(event) {
  const signature = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return json(400, { error: `Webhook signature verification failed: ${error.message}` });
  }

  const supabase = getAdminSupabase();

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    if (session.metadata?.product !== 'sentinel-care') return json(200, { received: true, ignored: true });
    const customerEmail = session.customer_details?.email;
    const plan = session.metadata?.plan || 'basic';
    if (customerEmail) {
      const { data: customer, error: customerError } = await supabase.from('customers').upsert({
        email: customerEmail,
        stripe_customer_id: session.customer,
        name: session.customer_details?.name || null
      }, { onConflict: 'email' }).select('*').single();
      if (customerError) return json(400, { error: customerError.message });
      await supabase.from('subscriptions').upsert({
        customer_id: customer.id,
        stripe_subscription_id: session.subscription,
        plan,
        status: 'active',
        current_period_start: new Date().toISOString()
      }, { onConflict: 'stripe_subscription_id' });
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted' || stripeEvent.type === 'customer.subscription.updated') {
    const subscription = stripeEvent.data.object;
    if (subscription.metadata?.product !== 'sentinel-care') return json(200, { received: true, ignored: true });
    await supabase.from('subscriptions').update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    }).eq('stripe_subscription_id', subscription.id);
  }

  return json(200, { received: true });
};
