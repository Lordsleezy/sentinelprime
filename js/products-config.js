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

export const CONNECTIONS = [
  ["sentinelos", "sentinel-x"],
  ["sentinelos", "personal-ai"],
  ["sentinelos", "guardian"],
  ["sentinelos", "forge"],
  ["forge", "forge-lite"]
];

export const PRODUCTS = [
  {
    slug: "sentinelos",
    name: "SentinelOS",
    tagline: "GrapheneOS security. BlissLauncher3 UI. Sentinel AI built in.",
    status: "building",
    statusLabel: "Building",
    color: CSS_COLORS.building,
    orbitRadius: 5,
    orbitSpeed: 0.09,
    orbitPhase: 0.4,
    orbitTilt: 0.12,
    planetRadius: 0.78,
    pageUrl: "sentinelos.html",
    features: [
      "GrapheneOS foundation with hardened defaults",
      "BlissLauncher3 for a clean, modern home screen",
      "Sentinel AI integrated at the OS level",
      "First supported device: Google Pixel 10a",
      "No tracking hooks, no silent telemetry"
    ],
    cta: { href: "index.html#waitlist", label: "Join Waitlist", variant: "fill" }
  },
  {
    slug: "sentinel-x",
    name: "Sentinel X",
    tagline: "The phone Big Tech won't make.",
    status: "soon",
    statusLabel: "Coming Soon",
    color: CSS_COLORS.cyan,
    orbitRadius: 7,
    orbitSpeed: 0.075,
    orbitPhase: 1.8,
    orbitTilt: -0.18,
    planetRadius: 0.88,
    pageUrl: "sentinel-x.html",
    features: [
      "Pre-loaded with SentinelOS — ready out of the box",
      "Pixel 10a base hardware, tuned for privacy",
      "Sentinel AI built in from day one",
      "Estimated pricing: $799–$1,199+ depending on configuration",
      "No carrier bloat, no data harvesting"
    ],
    cta: { href: "index.html#waitlist", label: "Join Waitlist", variant: "fill" }
  },
  {
    slug: "personal-ai",
    name: "Sentinel Personal AI",
    tagline: "Your AI. On your device. Forever private.",
    status: "available",
    statusLabel: "Available Now",
    color: CSS_COLORS.cyanBright,
    orbitRadius: 9,
    orbitSpeed: 0.11,
    orbitPhase: 3.2,
    orbitTilt: 0.22,
    planetRadius: 0.72,
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
    color: CSS_COLORS.red,
    orbitRadius: 11,
    orbitSpeed: 0.065,
    orbitPhase: 4.5,
    orbitTilt: -0.14,
    planetRadius: 0.82,
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
    color: CSS_COLORS.cyanDim,
    orbitRadius: 13,
    orbitSpeed: 0.055,
    orbitPhase: 5.7,
    orbitTilt: 0.16,
    planetRadius: 0.76,
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
    color: CSS_COLORS.muted,
    orbitRadius: 15,
    orbitSpeed: 0.095,
    orbitPhase: 0.9,
    orbitTilt: -0.2,
    planetRadius: 0.58,
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

export function getConnectionsForSlug(slug) {
  const linked = new Set();
  for (const [a, b] of CONNECTIONS) {
    if (a === slug) linked.add(b);
    if (b === slug) linked.add(a);
  }
  return [...linked];
}
