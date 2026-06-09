const { json } = require('./care-shared');

exports.handler = async function handler() {
  return json(200, {
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    siteUrl: process.env.SITE_URL || 'https://sentinelprime.org'
  });
};
