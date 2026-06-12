# Sentinel Prime Business Model Update - June 2026

## Summary

This document outlines the implementation of the new Sentinel Prime business model, replacing the old SentinelAI consumer pricing with the new product lineup.

---

## Old Business Model (ARCHIVED)

| Product | Price | Status |
|---------|-------|--------|
| SentinelAI Monthly | $14.99/mo | **ARCHIVE in Stripe** |
| SentinelAI Annual | $99/yr | **ARCHIVE in Stripe** |
| SentinelAI Lifetime | $499 | **ARCHIVE in Stripe** |
| Shift | $29 one-time | Now FREE |
| Shield | $19.99/yr | Now in Plus bundle |
| Care Basic | $19.99/mo | Replaced by Plus/Care add-ons |
| Care Plus | $34.99/mo | Replaced by Plus bundle |
| Prime X | $49.99/mo | Replaced by Plus bundle |

---

## New Business Model

### 1. Sentinel Shift — FREE & Open Source
- **Price**: Free
- **GitHub**: `Lordsleezy/Shift`
- **No Stripe product required**
- Positioned as entry point: "the easiest way to give an old laptop new life"

### 2. Sentinel Invest — Subscription
- **Price**: $9.99/month
- **Stripe Product**: Recurring subscription
- **Features**:
  - AI-powered trading signals
  - Strategy breakdowns (bull/bear case, technical analysis)
  - Paper and live execution via Alpaca
  - Real-time market alerts
- **Environment Variable**: `STRIPE_PRICE_INVEST_MONTHLY`

### 3. Sentinel Plus — Bundle Subscription
- **Price**: $149/year OR $19.99/month
- **Stripe Products**: Two recurring prices (same product, different intervals)
- **Includes**:
  - Sentinel Shield (security/cleaner)
  - Sentinel Care (AI-first tech support with human escalation)
  - Sentinel Command (mobile + web business/device control dashboard)
  - Sentinel Scout (AI finds best deals online, in real time)
  - **Sentinel Invest** (included as part of bundle)
- **Environment Variables**:
  - `STRIPE_PRICE_PLUS_MONTHLY` ($19.99/mo)
  - `STRIPE_PRICE_PLUS_ANNUAL` ($149/yr)

### 4. Founder/Early-Adopter Pricing
- **Badge**: "🔒 Founding Member Pricing — Lock in this rate for life"
- **Applies to**: Sentinel Plus AND Sentinel Invest
- **Mechanism**: Customers who subscribe now keep their price ID forever
- **Stripe Behavior**: Existing subscriptions on a price don't change when new prices are created
- **Implementation**: Metadata tag `founding_member: true` stored in checkout and subscription

### 5. Sentinel Care Add-ons — One-Time Payments
- **Not a subscription** — usage-based per session

| Service | Price | Environment Variable |
|---------|-------|---------------------|
| Remote Desktop (Member) | $40/hour | `STRIPE_PRICE_CARE_REMOTE_MEMBER` |
| Remote Desktop (Non-Member) | $100/hour | `STRIPE_PRICE_CARE_REMOTE_NONMEMBER` |
| Phone Support (Non-Member) | $10/call | `STRIPE_PRICE_CARE_PHONE_NONMEMBER` |

**Plus Member Benefit**: First remote session every 6 months is FREE

### 6. Sentinel Market
- **Status**: Separate storefront at `market.sentinelprime.org`
- **No changes** — already live via Medusa
- **Not included** in this pricing page

---

## Files Modified

### Configuration
- `.env.example` — Updated with new Stripe price ID placeholders
- `DEPLOY.md` — Updated deployment instructions

### Pricing Page
- `pricing.html` — Completely rewritten with new business model
  - Sentinel Shift card (free, open source)
  - Sentinel Invest card ($9.99/mo + founding member badge)
  - Sentinel Plus card (featured, $149/yr or $19.99/mo toggle + founding member badge)
  - Care add-ons section ($40/$100/$10)
  - FAQ updated

### Backend
- `lib/stripe_billing.js` — Updated PLANS config with new products + legacy support
- `netlify/functions/create-checkout.js` — Rewritten for new product/plan mapping
- `netlify/functions/webhook.js` — Updated to handle new plan types (invest, plus, care)

### Setup Script
- `scripts/setup-stripe-products.js` — New script to create Stripe products

---

## Stripe Setup Instructions

### Step 1: Run Setup Script (or Create Manually)

```bash
# Set your Stripe secret key
export STRIPE_SECRET_KEY=sk_test_... # or sk_live_...

# Run setup script
node scripts/setup-stripe-products.js
```

The script will output the new Price IDs to add to your environment variables.

### Step 2: Archive Old Products

In Stripe Dashboard:
1. Go to Products
2. Find old SentinelAI products ($14.99/mo, $99/yr, $499 lifetime)
3. **Archive** them (don't delete — preserves existing subscriptions)

### Step 3: Set Environment Variables in Netlify

Add these to Netlify Dashboard → Site settings → Environment variables:

```
STRIPE_PRICE_INVEST_MONTHLY=price_...
STRIPE_PRICE_PLUS_MONTHLY=price_...
STRIPE_PRICE_PLUS_ANNUAL=price_...
STRIPE_PRICE_CARE_REMOTE_MEMBER=price_...
STRIPE_PRICE_CARE_REMOTE_NONMEMBER=price_...
STRIPE_PRICE_CARE_PHONE_NONMEMBER=price_...
```

### Step 4: Deploy

```bash
git add .
git commit -m "Update to new business model - June 2026"
git push origin main
```

---

## Database Schema Notes

The `subscriptions` table stores the simplified plan types:
- `invest` — Sentinel Invest subscribers
- `plus` — Sentinel Plus subscribers (both monthly and annual)
- `care` — Care add-on purchases (one-time)
- `monthly`, `annual`, `lifetime` — Legacy SentinelAI (preserved for existing users)

The webhook handler maps detailed plan keys (e.g., `invest_monthly`, `plus_annual`) to these simplified types for easier querying.

---

## Testing Checklist

- [ ] Pricing page renders correctly
- [ ] Sentinel Shift links to GitHub repo
- [ ] Sentinel Invest checkout opens with $9.99/mo price
- [ ] Sentinel Plus monthly checkout opens with $19.99/mo price
- [ ] Sentinel Plus annual checkout opens with $149/yr price
- [ ] Founding Member badge visible on Invest and Plus cards
- [ ] Care add-on buttons trigger correct one-time payments
- [ ] Webhook receives events and stores correct plan type
- [ ] Success page shows after checkout completion
- [ ] Subscription appears in database with correct plan type

---

## Price IDs Reference

After running the setup script, record your Price IDs here:

```
STRIPE_PRICE_INVEST_MONTHLY=
STRIPE_PRICE_PLUS_MONTHLY=
STRIPE_PRICE_PLUS_ANNUAL=
STRIPE_PRICE_CARE_REMOTE_MEMBER=
STRIPE_PRICE_CARE_REMOTE_NONMEMBER=
STRIPE_PRICE_CARE_PHONE_NONMEMBER=
```

---

## Notes

- **Founding Member Pricing**: Stripe's default behavior locks in the price for existing subscriptions. When you create new prices for future customers, existing subscribers keep their original price.
- **Care Add-ons**: These are simple one-time payments. They don't create subscriptions in the database — just payment records.
- **Sentinel Market**: Already separate at `market.sentinelprime.org`. No changes needed there.
- **Legacy Support**: Old plan types (`monthly`, `annual`, `lifetime`) are still supported in the code for existing users.
