const { json, requireAdmin } = require('./care-shared');

exports.handler = async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  try {
    const { ticketId } = JSON.parse(event.body || '{}');
    const { supabase } = await requireAdmin(event);
    const { error } = await supabase.from('tickets').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', ticketId);
    if (error) throw error;
    return json(200, { ok: true });
  } catch (error) {
    return json(400, { error: error.message });
  }
};
