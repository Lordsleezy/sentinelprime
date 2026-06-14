# Sentinel Prime Deployment

## Making The Repository Private

1. In GitHub repository settings, change visibility to **Private**.
2. In Netlify, open **Site settings > Build & deploy > Repository**.
3. Use Netlify's repository access controls or deploy key flow to grant the site read access to the private repository.
4. Confirm a new Netlify deploy completes after the visibility change.
5. Keep environment variables in Netlify, never in the repository.

## Netlify Environment Variables

Set these in the Netlify dashboard:

```text
# Supabase
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY

# Stripe - Core
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PUBLISHABLE_KEY

# Stripe - NEW BUSINESS MODEL (June 2026)
STRIPE_PRICE_INVEST_MONTHLY
STRIPE_PRICE_PLUS_MONTHLY
STRIPE_PRICE_PLUS_ANNUAL
STRIPE_PRICE_CARE_REMOTE_MEMBER
STRIPE_PRICE_CARE_REMOTE_NONMEMBER
STRIPE_PRICE_CARE_PHONE_NONMEMBER

# OLD - Archive these in Stripe (kept for existing subscriptions)
# STRIPE_PRICE_MONTHLY
# STRIPE_PRICE_ANNUAL
# STRIPE_PRICE_LIFETIME

# Email
RESEND_API_KEY
RESEND_FROM

# Admin
ADMIN_EMAIL
ADMIN_PASSWORD

# Site
SITE_URL=https://sentinelprime.org
```

Use a long, random `ADMIN_PASSWORD`. Do not commit it to the repository.

## Stripe Setup

### New Business Model (June 2026)

Run the setup script to create new products:
```bash
node scripts/setup-stripe-products.js
```

Or manually create these products in Stripe:

1. **Sentinel Invest** - $9.99/month subscription
2. **Sentinel Plus** - $19.99/month OR $149/year subscription
3. **Care Remote (Member)** - $40 one-time payment
4. **Care Remote (Non-Member)** - $100 one-time payment
5. **Care Phone (Non-Member)** - $10 one-time payment

### Legacy Products (Archive, Don't Delete)

Archive these old products in Stripe Dashboard (to preserve existing subscriptions):
- SentinelAI Monthly ($14.99/mo)
- SentinelAI Annual ($99/yr)
- SentinelAI Lifetime ($499)

### Environment Variables

Add the Price IDs from the setup script output to Netlify environment variables.

### Webhook Configuration

1. Add `https://sentinelprime.org/.netlify/functions/webhook` as a Stripe webhook endpoint
2. Enable these events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `invoice.payment_succeeded`
3. Store the webhook signing secret in `STRIPE_WEBHOOK_SECRET`

## Supabase Setup

Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor. Use the service-role key only in Netlify environment variables.

### Blog (`/blog`)

The blog reads published posts from the `blog_posts` table via Netlify functions `get-blog-posts` and `get-blog-post`.

Required Netlify environment variables:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`SUPABASE_URL` must be the project root URL (not `/rest/v1/`).

1. Run [supabase/migrations/004_blog_posts.sql](supabase/migrations/004_blog_posts.sql) in the Supabase SQL editor, **or** call the one-time bootstrap function after setting `DATABASE_URL` or `SUPABASE_DB_PASSWORD`:

```bash
curl -X POST https://sentinelprime.org/api/setup-blog-db \
  -H "Authorization: Bearer $ADMIN_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"dbPassword":"<your-supabase-db-password>"}'
```

2. Optionally seed AI-generated articles:

```bash
node scripts/seed-blog.js --url https://sentinelprime.org --key $BLOG_ADMIN_KEY
```

Until the table exists, the API serves two built-in placeholder articles so `/blog` never shows a hard error.

