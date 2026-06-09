const { currentCycleStart, json, requireAdmin } = require('./care-shared');

exports.handler = async function handler(event) {
  try {
    const { supabase } = await requireAdmin(event);
    const { data: tickets } = await supabase.from('tickets_admin_view').select('*').eq('status', 'open').order('created_at', { ascending: false });
    const { count: openTickets } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open');
    const { count: monthlyInteractions } = await supabase.from('interactions').select('*', { count: 'exact', head: true }).gte('created_at', currentCycleStart());
    const { count: customers } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    return json(200, { tickets: tickets || [], stats: { openTickets: openTickets || 0, monthlyInteractions: monthlyInteractions || 0, customers: customers || 0 } });
  } catch (error) {
    return json(403, { error: error.message });
  }
};
