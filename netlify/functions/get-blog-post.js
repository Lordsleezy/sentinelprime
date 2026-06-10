const { createClient } = require('@supabase/supabase-js');

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }

  const params = event.queryStringParameters || {};
  const slug = (params.slug || '').trim();

  if (!slug) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing slug parameter' }) };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, content, category, created_at')
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error || !data) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post not found' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ post: data })
    };

  } catch (err) {
    console.error('[get-blog-post] Unexpected error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', detail: err.message }) };
  }
};
