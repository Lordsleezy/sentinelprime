const { createClient } = require('@supabase/supabase-js');

const FALLBACK_POSTS = [
  {
    id: 'fallback-welcome',
    title: 'Welcome to the Sentinel Prime Blog',
    slug: 'welcome-to-sentinel-prime-blog',
    excerpt:
      'Practical tech guides, privacy-first advice, and honest hardware picks from the Sentinel Prime team. New articles publish weekly.',
    category: 'Guides',
    created_at: '2026-06-01T12:00:00.000Z',
  },
  {
    id: 'fallback-security',
    title: '5 Free Ways to Protect Your PC in 2026',
    slug: '5-free-ways-protect-your-pc-2026',
    excerpt:
      'You do not need expensive antivirus suites to stay safer online. These five free habits and tools cover most everyday threats.',
    category: 'Security',
    created_at: '2026-06-08T12:00:00.000Z',
  },
];

function supabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || '';
  const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '');
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { supabaseUrl, supabaseKey };
}

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=120',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const { supabaseUrl, supabaseKey } = supabaseConfig();

  if (!supabaseUrl || !supabaseKey) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts: FALLBACK_POSTS, count: FALLBACK_POSTS.length, fallback: true }),
    };
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
      if (error.code === 'PGRST205' || /invalid api key/i.test(error.message || '')) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ posts: FALLBACK_POSTS, count: FALLBACK_POSTS.length, fallback: true }),
        };
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error', detail: error.message }) };
    }

    const posts = data || [];
    if (posts.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ posts: [], count: 0 }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts, count: posts.length }),
    };
  } catch (err) {
    console.error('[get-blog-posts] Unexpected error:', err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ posts: FALLBACK_POSTS, count: FALLBACK_POSTS.length, fallback: true }),
    };
  }
};
