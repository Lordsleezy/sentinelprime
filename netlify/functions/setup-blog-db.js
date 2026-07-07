const { readFileSync } = require('fs');
const { join } = require('path');
const { json, method, parseBody } = require('./utils/http');

const PLACEHOLDER_POSTS = [
  {
    title: 'Welcome to the Sentinel Prime Blog',
    slug: 'welcome-to-sentinel-prime-blog',
    excerpt:
      'Practical tech guides, privacy-first advice, and honest hardware picks from the Sentinel Prime team. New articles publish weekly.',
    category: 'Guides',
    content: `# Welcome to the Sentinel Prime Blog

We're building a knowledge base for everyday PC users who want clear answers without upsells or jargon.

## What you'll find here

- **Linux & OS guides** — dual-boot setups, distro picks, and migration tips
- **Security basics** — free tools and habits that actually help
- **Hardware & refurb deals** — how to shop smart on a budget
- **Performance fixes** — speed up slow Windows machines without bloatware

## Why Sentinel Prime

Sentinel Prime builds privacy-first tools: [SentinelCare](/care) for practical support, [Sentinel Prospects](https://prospects.sentinelprime.org) for construction opportunity intelligence, [Sentinel Guardian](/guardian) for security, and [Sentinel Linux](/products#linux) for cleaner computing.`,
    published: true,
  },
  {
    title: '5 Free Ways to Protect Your PC in 2026',
    slug: '5-free-ways-protect-your-pc-2026',
    excerpt:
      'You do not need expensive antivirus suites to stay safer online. These five free habits and tools cover most everyday threats.',
    category: 'Security',
    content: `# 5 Free Ways to Protect Your PC in 2026

Good security is mostly about habits, not expensive software.

## 1. Keep Windows or Linux updated

## 2. Use a password manager

## 3. Turn on disk encryption

## 4. Be skeptical of urgent emails and links

## 5. Run Sentinel Shield for local scanning

[Sentinel Care](/care) connects you with a real technician when you need help.`,
    published: true,
  },
];

function authorized(event) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const provided = authHeader.replace(/^Bearer\s+/i, '');
  return provided === adminPassword;
}

function connectionString(body) {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD || body.dbPassword;
  if (!password) return null;
  const projectRef = (process.env.SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || process.env.SUPABASE_PROJECT_REF;
  if (!projectRef) return null;
  const region = process.env.SUPABASE_DB_REGION || 'us-west-1';
  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
}

exports.handler = async function handler(event) {
  if (!method(event, ['POST', 'OPTIONS'])) {
    return json(405, { error: 'Method not allowed' });
  }
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }
  if (!authorized(event)) {
    return json(401, { error: 'Unauthorized' });
  }

  const body = parseBody(event);
  const conn = connectionString(body);
  if (!conn) {
    return json(400, {
      error: 'Set DATABASE_URL or SUPABASE_DB_PASSWORD in Netlify, or pass dbPassword in the request body.',
    });
  }

  let Client;
  try {
    ({ Client } = require('pg'));
  } catch (err) {
    return json(500, { error: 'pg module not installed', detail: err.message });
  }

  const sqlPath = join(__dirname, '../../supabase/migrations/004_blog_posts.sql');
  const migrationSql = readFileSync(sqlPath, 'utf8');
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(migrationSql);

    const { createClient } = require('@supabase/supabase-js');
    const rawUrl = process.env.SUPABASE_URL || '';
    const supabaseUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/v1\/?$/, '').replace(/\/+$/, '');
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return json(200, { success: true, migration: 'applied', seeded: 0, note: 'Table created; add SUPABASE_SERVICE_ROLE_KEY to seed posts.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const seeded = [];
    for (const post of PLACEHOLDER_POSTS) {
      const { data: existing } = await supabase.from('blog_posts').select('id').eq('slug', post.slug).maybeSingle();
      if (existing) {
        seeded.push({ slug: post.slug, status: 'exists' });
        continue;
      }
      const { error } = await supabase.from('blog_posts').insert([post]);
      if (error) throw error;
      seeded.push({ slug: post.slug, status: 'inserted' });
    }

    return json(200, { success: true, migration: 'applied', seeded });
  } catch (err) {
    console.error('[setup-blog-db]', err);
    return json(500, { error: 'Setup failed', detail: err.message });
  } finally {
    await client.end().catch(() => {});
  }
};
