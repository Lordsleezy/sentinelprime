/** Shared product data for legacy ecosystem-map pages. */
export const CSS_COLORS = {
  cyan: "#00d4ff",
  cyanDim: "#00a8cc",
  cyanBright: "#e8f4ff",
  red: "#cc0000",
  building: "#f5b942",
  muted: "#8a8a90",
  white: "#ffffff"
};

export const PRODUCT_TIERS = {
  hero: { priority: 3, labelScale: 1.12, pointSize: 0.24, edgeBoost: 1.25, glow: 1.35 },
  secondary: { priority: 2, labelScale: 1, pointSize: 0.18, edgeBoost: 1, glow: 1 },
  developer: { priority: 1, labelScale: 0.9, pointSize: 0.14, edgeBoost: 0.82, glow: 0.78 }
};

export const PRODUCTS = [
  {
    slug: "sentinel-ai",
    name: "Sentinel AI",
    tagline: "Your personal AI operating system.",
    status: "available",
    statusLabel: "Available",
    tier: "hero",
    color: CSS_COLORS.cyan,
    cellAxis: "+X",
    pageUrl: "/sentinel-ai",
    features: ["15+ specialized workers", "Voice, memory, code, security, markets, and smart home", "Runs on your machine"],
    cta: { href: "/sentinel-ai", label: "Explore Sentinel AI", variant: "fill" }
  },
  {
    slug: "personal-ai",
    name: "Sentinel Personal AI",
    tagline: "Your AI. On your device.",
    status: "available",
    statusLabel: "Available",
    tier: "secondary",
    color: CSS_COLORS.cyan,
    cellAxis: "+Y",
    pageUrl: "/personal-ai.html",
    features: ["iOS companion app", "Local-first memory", "Private personal workflows"],
    cta: { href: "https://apps.apple.com/app/id6767139428", label: "App Store", variant: "fill", external: true }
  },
  {
    slug: "sentinel-drive",
    name: "Sentinel Drive",
    tagline: "Your AI. In your pocket.",
    status: "soon",
    statusLabel: "Coming Soon",
    tier: "secondary",
    color: CSS_COLORS.cyanDim,
    cellAxis: "+Z",
    pageUrl: "/sentinel-drive",
    features: ["Encrypted portable workspace", "Encrypted password vault with auto-fill", "Works on iOS, Android, Windows, macOS, iPadOS, and Linux"],
    cta: { href: "/sentinel-drive#notify", label: "Notify Me", variant: "fill" }
  }
];

export function getProduct(slug) {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getProductByCell(cellAxis) {
  return PRODUCTS.find((product) => product.cellAxis === cellAxis);
}

export function getTierStyle(tier) {
  return PRODUCT_TIERS[tier] ?? PRODUCT_TIERS.secondary;
}
