# Local Setup

1. Install dependencies with `npm install`.
2. Create a Supabase project.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Copy `.env.example` to `.env.local` and add local values.
5. Create a Resend account and add `RESEND_API_KEY`.
6. Run `npm run dev`.
7. Open `http://localhost:8888`.

Stripe can remain unconfigured initially. Checkout buttons will show a clear configuration message until Stripe variables are present.

## Preview Checklist

Open:

- `/pricing`
- `/checkout`
- `/login`
- `/account`
- `/resend-code`
- `/admin`

The account, persisted activation-code, and admin login workflows require Supabase environment variables. Admin email delivery additionally requires Resend. Stripe-hosted checkout requires Stripe variables.

Validate a persisted code after Supabase is configured:

```powershell
curl.exe -X POST http://localhost:8888/api/validate `
  -H "Content-Type: application/json" `
  -d '{\"code\":\"SNTL-XXXX-XXXX-XXXX\"}'
```

