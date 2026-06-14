const { createClient } = require('@supabase/supabase-js');

const FALLBACK_POSTS = {
  'welcome-to-sentinel-prime-blog': {
    id: 'fallback-welcome',
    title: 'Welcome to the Sentinel Prime Blog',
    slug: 'welcome-to-sentinel-prime-blog',
    excerpt:
      'Practical tech guides, privacy-first advice, and honest hardware picks from the Sentinel Prime team. New articles publish weekly.',
    category: 'Guides',
    created_at: '2026-06-01T12:00:00.000Z',
    content: `# Welcome to the Sentinel Prime Blog

We're building a knowledge base for everyday PC users who want clear answers without upsells or jargon.

## What you'll find here

- **Linux & OS guides** — dual-boot setups, distro picks, and migration tips
- **Security basics** — free tools and habits that actually help
- **Hardware & refurb deals** — how to shop smart on a budget
- **Performance fixes** — speed up slow Windows machines without bloatware

## Why Sentinel Prime

Sentinel Prime builds privacy-first tools: [Sentinel Care](/care) for real tech support, [SentinelAI](/sentinel-ai) for local AI, and [Sentinel Market](/market) for curated gear.

## Check back soon

We're publishing new guides every week. Bookmark this page or explore [Sentinel Care](/care) if you need hands-on help today.`,
  },
  '5-free-ways-protect-your-pc-2026': {
    id: 'fallback-security',
    title: '5 Free Ways to Protect Your PC in 2026',
    slug: '5-free-ways-protect-your-pc-2026',
    excerpt:
      'You do not need expensive antivirus suites to stay safer online. These five free habits and tools cover most everyday threats.',
    category: 'Security',
    created_at: '2026-06-08T12:00:00.000Z',
    content: `# 5 Free Ways to Protect Your PC in 2026

Good security is mostly about habits, not expensive software.

## 1. Keep Windows or Linux updated

Security patches close real holes. Enable automatic updates and reboot when prompted.

## 2. Use a password manager

Reuse is the biggest risk. Bitwarden and similar tools are free for personal use.

## 3. Turn on disk encryption

BitLocker (Windows Pro) or Linux LUKS protects your data if a laptop is lost or stolen.

## 4. Be skeptical of urgent emails and links

Phishing beats malware most days. When in doubt, type the site address yourself.

## 5. Run Sentinel Shield for local scanning

[Sentinel Shield](/products) adds on-device scanning and quarantine without sending your files to the cloud.

## Need help?

If something feels off on your machine, [Sentinel Care](/care) connects you with a real technician — not a script.`,
  },
};

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
    'Cache-Control': 'public, max-age=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const slug = (params.slug || '').trim();

  if (!slug) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing slug parameter' }) };
  }

  const fallback = FALLBACK_POSTS[slug];
  const { supabaseUrl, supabaseKey } = supabaseConfig();

  if (!supabaseUrl || !supabaseKey) {
    if (fallback) {
      return { statusCode: 200, headers, body: JSON.stringify({ post: fallback, fallback: true }) };
    }
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post not found' }) };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, content, category, created_at')
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error) {
      if (error.code === 'PGRST205' && fallback) {
        return { statusCode: 200, headers, body: JSON.stringify({ post: fallback, fallback: true }) };
      }
      if (error.code === 'PGRST116' && fallback) {
        return { statusCode: 200, headers, body: JSON.stringify({ post: fallback, fallback: true }) };
      }
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post not found' }) };
    }

    if (!data) {
      if (fallback) {
        return { statusCode: 200, headers, body: JSON.stringify({ post: fallback, fallback: true }) };
      }
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Post not found' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ post: data }),
    };
  } catch (err) {
    console.error('[get-blog-post] Unexpected error:', err);
    if (fallback) {
      return { statusCode: 200, headers, body: JSON.stringify({ post: fallback, fallback: true }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error', detail: err.message }) };
  }
};
