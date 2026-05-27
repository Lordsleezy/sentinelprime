/** Shared product data for galaxy map and standalone pages */
export const CSS_COLORS = {
  cyan: "#00d4ff",
  cyanDim: "#00a8cc",
  cyanBright: "#e8f4ff",
  red: "#cc0000",
  building: "#f5b942",
  muted: "#8a8a90",
  white: "#ffffff"
};

/** Visual + narrative hierarchy for ecosystem layout */
export const PRODUCT_TIERS = {
  hero: { priority: 3, labelScale: 1.12, pointSize: 0.24, edgeBoost: 1.25, glow: 1.35 },
  secondary: { priority: 2, labelScale: 1, pointSize: 0.18, edgeBoost: 1, glow: 1 },
  developer: { priority: 1, labelScale: 0.9, pointSize: 0.14, edgeBoost: 0.82, glow: 0.78 }
};

export const PRODUCTS = [
  {
    slug: "open-claw",
    name: "Open Claw",
    tagline: "Open-source control for the Sentinel ecosystem.",
    status: "building",
    statusLabel: "Building",
    tier: "hero",
    color: CSS_COLORS.cyan,
    cellAxis: "+X",
    pageUrl: "products.html#open-claw",
    features: [
      "Open-source control layer for Sentinel tools",
      "Designed for transparent automation",
      "Built for creators, developers, and power users",
      "Connects local workflows across the ecosystem",
      "Privacy-first by design"
    ],
    cta: { href: "products.html#open-claw", label: "Explore Open Claw", variant: "fill" }
  },
  {
    slug: "personal-ai",
    name: "Sentinel Personal AI",
    tagline: "Your AI. On your device. Forever private.",
    status: "available",
    statusLabel: "Available Now",
    tier: "secondary",
    color: CSS_COLORS.cyan,
    cellAxis: "+Y",
    pageUrl: "personal-ai.html",
    features: [
      "Free iOS app — download today",
      "On-device inference, no server-side profile",
      "No data collection, no account wall for core features",
      "Local-first memory and conversations",
      "Auditable architecture you can inspect"
    ],
    cta: {
      href: "https://apps.apple.com/app/id6767139428",
      label: "App Store",
      variant: "fill",
      external: true
    }
  },
  {
    slug: "guardian",
    name: "Sentinel Guardian",
    tagline: "Security Intelligence. No limits.",
    status: "soon",
    statusLabel: "Coming Soon",
    tier: "secondary",
    color: CSS_COLORS.red,
    cellAxis: "-Y",
    pageUrl: "guardian.html",
    features: [
      "AI-powered cyber defense for personal and business use",
      "Attack, defend, and forensics in one workspace",
      "$19.99/mo personal · $99/mo business (planned)",
      "Windows desktop and mobile field workflows",
      "Early access via contact — onboarding partners now"
    ],
    cta: { href: "contact.html", label: "Request Access", variant: "red" }
  },
  {
    slug: "forge",
    name: "Forge by Sentinel",
    tagline: "The AI dev platform that builds Android.",
    status: "soon",
    statusLabel: "Coming Soon",
    tier: "developer",
    color: CSS_COLORS.cyanDim,
    cellAxis: "+Z",
    pageUrl: "forge.html",
    features: [
      "Builds apps, ROMs, and security tools from natural language",
      "Local AI via Ollama — works fully offline on free tier",
      "Flashes real devices from your machine",
      "BYOK or managed Claude API tiers available",
      "Hardware-adaptive model selection"
    ],
    cta: { href: "pricing.html", label: "See Pricing", variant: "fill" }
  },
  {
    slug: "forge-lite",
    name: "Forge Lite",
    tagline: "Your machine in your pocket.",
    status: "soon",
    statusLabel: "Coming Soon",
    tier: "developer",
    color: CSS_COLORS.muted,
    cellAxis: "-Z",
    pageUrl: "forge-lite.html",
    features: [
      "SSH terminal for iPhone and Android",
      "Pair with Forge on desktop via QR code",
      "No account required for core terminal use",
      "Free download at launch",
      "Control your dev environment from anywhere"
    ],
    cta: { href: "index.html#waitlist", label: "Notify Me", variant: "fill" }
  }
];

export function getProduct(slug) {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductByCell(cellAxis) {
  return PRODUCTS.find((p) => p.cellAxis === cellAxis);
}

export function getTierStyle(tier) {
  return PRODUCT_TIERS[tier] ?? PRODUCT_TIERS.secondary;
}
