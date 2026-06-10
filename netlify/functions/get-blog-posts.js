const { createClient } = require('@supabase/supabase-js');

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=120'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const params = event.queryStringParameters || {};
    const limit = Math.min(parseInt(params.limit || '50', 10), 100);
    const offset = parseInt(params.offset || '0', 10);
    const category = params.category || null;

    let query = supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, category, created_at')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[get-blog-posts] Supabase error:', error);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error', detail: error.message }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts: data || [], count: (data || []).length })
    };

  } catch (err) {
    console.error('[get-blog-posts] Unexpected error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', detail: err.message }) };
  }
};
