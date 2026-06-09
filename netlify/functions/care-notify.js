const { currentCycleStart, getActiveSubscription, getOrCreateCustomer, getUsage, json, planLimits, requireUser, sendSupportEmail } = require('./care-shared');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const { type, summary, details } = JSON.parse(event.body || '{}');
    const { supabase, user } = await requireUser(event);
    const customer = await getOrCreateCustomer(supabase, user);
    const subscription = await getActiveSubscription(supabase, customer.id);
    const usage = await getUsage(supabase, customer.id);
    const limits = planLimits(subscription?.plan);

    if (type === 'phone_callback' && subscription?.plan !== 'plus') {
      return json(403, { error: 'Phone callback support requires the Plus plan.' });
    }

    const overage = usage.humanInteractions >= limits.humanInteractions || (type === 'remote_session' && usage.remoteSessions >= limits.remoteSessions);
    const { data: ticket, error: ticketError } = await supabase.from('tickets').insert({
      customer_id: customer.id,
      type,
      issue_summary: summary || 'Support request',
      details,
      status: 'open',
      overage
    }).select('*').single();
    if (ticketError) throw ticketError;

    const { error: interactionError } = await supabase.from('interactions').insert({
      customer_id: customer.id,
      ticket_id: ticket.id,
      type,
      summary,
      billing_cycle_start: currentCycleStart(),
      is_overage: overage
    });
    if (interactionError) throw interactionError;

    await sendSupportEmail(ticket, customer);
    return json(200, { ticket, overage });
  } catch (error) {
    return json(400, { error: error.message });
  }
};
