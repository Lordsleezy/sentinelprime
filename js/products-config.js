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
    slug: "sentinel-linux",
    name: "Sentinel Linux",
    tagline: "A cleaner path to privacy-first computing.",
    status: "available",
    statusLabel: "Available",
    tier: "hero",
    color: CSS_COLORS.cyan,
    cellAxis: "+X",
    pageUrl: "/products#linux",
    features: ["Linux migration tools", "Rollback planning", "Privacy-first setup"],
    cta: { href: "/products#linux", label: "Explore Sentinel Linux", variant: "fill" }
  },
  {
    slug: "sentinel-guardian",
    name: "Sentinel Guardian",
    tagline: "Security tooling for real-world defense.",
    status: "available",
    statusLabel: "Available",
    tier: "secondary",
    color: CSS_COLORS.cyan,
    cellAxis: "+Y",
    pageUrl: "/guardian",
    features: ["Scanning", "Monitoring", "Practical hardening workflows"],
    cta: { href: "/guardian", label: "Explore Guardian", variant: "fill" }
  },
  {
    slug: "sentinel-projects",
    name: "Sentinel Projects",
    tagline: "Construction Opportunity Intelligence.",
    status: "available",
    statusLabel: "Available",
    tier: "secondary",
    color: CSS_COLORS.cyanDim,
    cellAxis: "+Z",
    pageUrl: "https://projects.sentinelprime.org",
    features: ["Permits", "Planning records", "Bids and development signals"],
    cta: { href: "https://projects.sentinelprime.org", label: "Launch Sentinel Projects", variant: "fill", external: true }
  },
  {
    slug: "sentinelcare",
    name: "SentinelCare",
    tagline: "Personal IT support without the runaround.",
    status: "available",
    statusLabel: "Available",
    tier: "secondary",
    color: CSS_COLORS.cyan,
    cellAxis: "-X",
    pageUrl: "/care",
    features: ["Guided support", "Technician escalation", "Computer, printer, Wi-Fi, and software help"],
    cta: { href: "/care", label: "Open SentinelCare", variant: "fill" }
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
