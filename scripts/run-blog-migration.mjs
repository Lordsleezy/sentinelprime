#!/usr/bin/env node
/**
 * Apply blog_posts migration via direct Postgres (needs SUPABASE_DB_PASSWORD).
 * Usage: SUPABASE_DB_PASSWORD=... node scripts/run-blog-migration.mjs
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '../supabase/migrations/004_blog_posts.sql'), 'utf8');

const password = process.env.SUPABASE_DB_PASSWORD || process.argv.find((a) => a.startsWith('--password='))?.slice(11);
if (!password) {
  console.error('Set SUPABASE_DB_PASSWORD or pass --password=...');
  console.error('Find it in Supabase Dashboard → Project Settings → Database');
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL ||
  (password
    ? `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${encodeURIComponent(password)}@aws-0-${process.env.SUPABASE_DB_REGION || 'us-west-1'}.pooler.supabase.com:6543/postgres`
    : null);

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log('Migration 004_blog_posts applied.');
} finally {
  await client.end();
}
