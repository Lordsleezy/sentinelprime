const { currentCycleStart, getOrCreateCustomer, json, requireUser } = require('./care-shared');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const { type, summary } = JSON.parse(event.body || '{}');
    const { supabase, user } = await requireUser(event);
    const customer = await getOrCreateCustomer(supabase, user);
    const { data, error } = await supabase.from('interactions').insert({
      customer_id: customer.id,
      type,
      summary,
      billing_cycle_start: currentCycleStart()
    }).select('*').single();
    if (error) throw error;
    return json(200, { interaction: data });
  } catch (error) {
    return json(400, { error: error.message });
  }
};
