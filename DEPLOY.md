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
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_MONTHLY
STRIPE_PRICE_ANNUAL
STRIPE_PRICE_LIFETIME
RESEND_API_KEY
RESEND_FROM
ADMIN_EMAIL
ADMIN_PASSWORD_HASH
SITE_URL=https://sentinelprime.org
```

Generate the initial administrator password hash locally. Do not commit the password or hash:

```powershell
node -e "const bcrypt=require('bcryptjs'); bcrypt.hash(process.argv[1],12).then(console.log)" "your-long-admin-password"
```

## Stripe Setup

1. Create monthly, annual, and lifetime Stripe products.
2. Add their Price IDs to the corresponding Netlify variables.
3. Add `https://sentinelprime.org/api/webhook` as a Stripe webhook.
4. Enable `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`, and `invoice.payment_failed`.
5. Store the webhook signing secret in `STRIPE_WEBHOOK_SECRET`.

## Supabase Setup

Run [supabase/schema.sql](supabase/schema.sql) in the Supabase SQL editor. Use the service-role key only in Netlify environment variables.

