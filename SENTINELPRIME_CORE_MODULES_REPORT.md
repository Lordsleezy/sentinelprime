# Sentinel Prime Core Modules Report

## Search Findings

Searched the repo for old references to SentinelWeb, Sentinel Web, Sentinel AI, SentinelAI, AI Web, web form, demos, products, nav, dropdown, site-config, assistant, and form.

- SentinelWeb existed only in the new private beta page and shared config added during this work.
- No older SentinelWeb page, tab, or web form was present in this checkout.
- Sentinel AI references existed as product and ecosystem copy in `index.html`, `products.html`, `sentinelos.html`, `sentinel-x.html`, `story.html`, `privacy.html`, and `js/products-config.js`.
- Existing forms found were the Netlify contact form in `contact.html` and the Formspree waitlist form in `index.html`.
- No previous dedicated `sentinelai.html` page was present, so a new core SentinelAI page was added rather than restoring a deleted file.

## Pages Added Or Restored

- `sentinelweb.html`: core SentinelWeb private beta page connected to the live Railway backend.
- `sentinelai.html`: core SentinelAI product page for the private AI command and operations platform.
- `products.html`: updated to include SentinelAI and SentinelWeb as first-class product sections.

## Shared Theme And Branding

Global theme tokens now live in:

- `css/theme.css`

The existing shared styles import those tokens from:

- `css/index-landing.css`
- `css/style.css`

Important tokens:

- `--theme-background`
- `--theme-primary-accent`
- `--theme-secondary-accent`
- `--theme-card-color`
- `--theme-border-color`
- `--theme-glow-color`
- `--theme-text-color`
- `--theme-muted-text`
- `--theme-button-bg`

Update `css/theme.css` to change the site-wide color system, card styling, glow strength, and shared button styling.

## Shared Config, Nav, And API URLs

Global site config now lives in:

- `js/site-config.js`

It defines:

- `SITE_NAME`
- `BRAND_NAME`
- `API_BASES`
- `SENTINELWEB_API_BASE`
- `NAV_ITEMS`
- `PRODUCT_ITEMS`
- `THEME_TOKENS`
- `DEMO_LINKS`
- `DEMOS`

Shared header/footer rendering lives in:

- `js/components.js`

Navigation is now config-driven from `NAV_ITEMS`, including the Products dropdown and top-level SentinelAI/SentinelWeb links. To update the SentinelWeb backend URL, change:

```js
window.API_BASES = {
  sentinelweb: "https://sentinelweb-production-1d18.up.railway.app"
};
```

`sentinelweb.html` uses `window.SENTINELWEB_API_BASE` instead of duplicating the Railway URL in page markup.

## SentinelWeb Safety Behavior

The SentinelWeb page keeps the backend safety model intact:

- No frontend secrets or API keys are present.
- Requests are sent to the protected Railway backend.
- 403 responses show: "Private beta access required. Contact Sentinel Prime for access."
- The page does not bypass auth, captchas, bot protections, backend rate limits, or backend provider restrictions.
- The page displays private beta messaging before use.

## Remaining Cleanup Suggestions

- Move the larger inline SentinelWeb and SentinelAI page styles into shared CSS when the design settles.
- If a real SentinelAI command form is later added, keep it separate from SentinelWeb inventory workflows.
- Consider updating the 3D product galaxy data if SentinelAI and SentinelWeb should appear inside the interactive galaxy itself.
- Add production monitoring around the Railway backend separately from the public frontend.
