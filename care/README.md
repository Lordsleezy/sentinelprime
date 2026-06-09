# Sentinel Care

Sentinel Care is a static Netlify app for Sentinel Prime's tech support subscription service at `sentinelprime.org/care`.

## Features

- Landing page with Basic and Plus pricing
- Stripe subscription checkout
- Supabase magic-link auth and customer portal
- Client-side AI support chat using Transformers.js
- Ticket escalation with Supabase tracking and Resend email notifications
- Admin panel protected for `paul@sentinelprime.org`
- Netlify Functions backend for secrets and privileged operations

## Stack

- Static HTML, CSS, and JavaScript
- Netlify static hosting and serverless functions
- Supabase Auth and Postgres
- Stripe Checkout and webhooks
- Resend email notifications
- Transformers.js in-browser AI

## Local setup

1. Install dependencies.

```bash
npm install
```

2. Copy environment variables.

```bash
cp .env.example .env
```

3. Fill in `.env` with Supabase, Stripe, and Resend values.

4. Create the Supabase schema by running `supabase/schema.sql` in the Supabase SQL editor.

5. Start local Netlify development.

```bash
npm run dev
```

## Required environment variables

```bash
SITE_URL=https://sentinelprime.org/care
ADMIN_EMAIL=paul@sentinelprime.org
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_BASIC_PRICE_ID=
STRIPE_PLUS_PRICE_ID=
RESEND_API_KEY=
SUPPORT_NOTIFICATION_EMAIL=paul@sentinelprime.org
FROM_EMAIL=Sentinel Care <support@sentinelprime.org>
```

## Stripe setup

Create two monthly recurring prices:

- Basic: `$14.99/month`
- Plus: `$29.99/month`

Set the price IDs in Netlify environment variables. Configure a webhook pointing to:

```text
https://sentinelprime.org/care/api/webhook
```

Recommended events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Supabase setup notes

- Enable email magic links in Supabase Auth.
- Add `https://sentinelprime.org/care/care/portal` and `https://sentinelprime.org/care/care/admin` as allowed redirect URLs.
- The Netlify Functions use the service role key for privileged inserts, admin data, and Stripe webhook updates.

## Deployment

1. Create a Netlify site connected to this GitHub repo.
2. Set the custom domain to `sentinelprime.org/care`.
3. Add all environment variables in Netlify.
4. Deploy with publish directory `public` and functions directory `netlify/functions`.

The included `netlify.toml` already defines the build settings.

## AI model note

The portal attempts to load `Xenova/Phi-3-mini-4k-instruct` in the browser. First load can be large and slow. If the model fails to load, the app falls back to guided local support responses so the portal remains usable.
