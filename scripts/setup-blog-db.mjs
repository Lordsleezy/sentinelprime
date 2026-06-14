#!/usr/bin/env node
/**
 * Seed placeholder blog posts (requires blog_posts table — run 004_blog_posts.sql first).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.argv.find((a) => a.startsWith('--key='))?.slice(6);

if (!BASE) {
  console.error('Set SUPABASE_URL');
  process.exit(1);
}

if (!KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY or pass --key=...');
  process.exit(1);
}

async function rest(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : undefined,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

const placeholders = [
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

Sentinel Prime builds privacy-first tools: [Sentinel Care](/care) for real tech support, [SentinelAI](/sentinel-ai) for local AI, and [Sentinel Market](/market) for curated gear.

## Check back soon

We're publishing new guides every week. Bookmark this page or explore [Sentinel Care](/care) if you need hands-on help today.`,
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
    published: true,
  },
];

async function main() {
  const migrationPath = join(__dirname, '../supabase/migrations/004_blog_posts.sql');
  console.log('Migration file:', migrationPath);
  console.log('Supabase:', BASE);

  const probe = await rest('GET', '/rest/v1/blog_posts?select=id&limit=1');
  if (probe.text.includes('PGRST205')) {
    console.error('\nblog_posts table is missing.');
    console.error('Run this SQL in Supabase Dashboard → SQL Editor:\n');
    console.error(readFileSync(migrationPath, 'utf8'));
    process.exit(2);
  }
  if (probe.status >= 400) {
    throw new Error(`Probe failed (${probe.status}): ${probe.text}`);
  }

  for (const post of placeholders) {
    const existing = await rest('GET', `/rest/v1/blog_posts?slug=eq.${encodeURIComponent(post.slug)}&select=id`);
    if (existing.status === 200 && existing.text !== '[]') {
      console.log('Skip (exists):', post.slug);
      continue;
    }
    const inserted = await rest('POST', '/rest/v1/blog_posts', post);
    if (inserted.status >= 400) {
      throw new Error(`Insert ${post.slug} (${inserted.status}): ${inserted.text}`);
    }
    console.log('Seeded:', post.slug);
  }

  const count = await rest('GET', '/rest/v1/blog_posts?select=id&published=eq.true');
  const posts = JSON.parse(count.text || '[]');
  console.log(`Done. ${posts.length} published post(s).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
