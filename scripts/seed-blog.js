#!/usr/bin/env node
/**
 * Seed script: generates 10 starter blog articles via the generate-blog function.
 * Usage: node scripts/seed-blog.js [--url https://sentinelprime.org] [--key BLOG_ADMIN_KEY]
 *
 * Set SUPABASE_URL + SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 * and GROQ_API_KEY in environment, OR pass --url pointing to live Netlify deploy.
 */

require('dotenv').config();

const TOPICS = [
  'how to install linux without losing windows',
  'geek squad alternative cheaper',
  'best refurbished laptops 2026',
  'how to protect your PC from viruses free',
  'linux for beginners guide',
  'best budget laptops for students 2026',
  'how to speed up a slow Windows PC',
  'is geek squad worth it',
  'best free antivirus 2026',
  'how to switch from Windows to Linux'
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateArticle(baseUrl, adminKey, topic) {
  const url = baseUrl.replace(/\/$/, '') + '/api/generate-blog';
  const headers = { 'Content-Type': 'application/json' };
  if (adminKey) headers['Authorization'] = 'Bearer ' + adminKey;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ topic })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error('HTTP ' + res.status + ': ' + (data.error || JSON.stringify(data)));
  }

  return data;
}

async function main() {
  const args = process.argv.slice(2);
  let baseUrl = 'http://localhost:8888';
  let adminKey = process.env.BLOG_ADMIN_KEY || '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) baseUrl = args[++i];
    if (args[i] === '--key' && args[i + 1]) adminKey = args[++i];
  }

  console.log('=== Sentinel Prime Blog Seed Script ===');
  console.log('Target URL:', baseUrl);
  console.log('Topics to seed:', TOPICS.length);
  console.log('');

  const results = [];

  for (let i = 0; i < TOPICS.length; i++) {
    const topic = TOPICS[i];
    process.stdout.write('[' + (i + 1) + '/' + TOPICS.length + '] Generating: "' + topic + '" ... ');

    try {
      const result = await generateArticle(baseUrl, adminKey, topic);
      const post = result.post || result;
      console.log('✓ ' + (post.slug || 'done'));
      results.push({ topic, status: 'ok', slug: post.slug, title: post.title });
    } catch (err) {
      console.log('✗ ERROR: ' + err.message);
      results.push({ topic, status: 'error', error: err.message });
    }

    if (i < TOPICS.length - 1) {
      process.stdout.write('  (waiting 3s to avoid rate limits...)\n');
      await sleep(3000);
    }
  }

  console.log('\n=== SEED RESULTS ===');
  const ok = results.filter(r => r.status === 'ok');
  const errors = results.filter(r => r.status === 'error');
  console.log('Success: ' + ok.length + '/' + TOPICS.length);
  if (errors.length) {
    console.log('\nFailed:');
    errors.forEach(r => console.log('  - "' + r.topic + '": ' + r.error));
  }
  console.log('\nBlog URL: ' + baseUrl.replace(/\/$/, '') + '/blog');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
