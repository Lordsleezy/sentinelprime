window.SITE_NAME = "Sentinel Prime";
window.BRAND_NAME = "SENTINEL PRIME";

window.API_BASES = {
  sentinelweb: "https://sentinelweb-production-1d18.up.railway.app"
};

window.SENTINELWEB_API_BASE = window.API_BASES.sentinelweb;

window.NAV_ITEMS = [
  { label: "Home", href: "/index.html", key: "home" },
  {
    label: "Products",
    href: "/products.html",
    key: "products",
    children: [
      { label: "Forge", href: "/forge.html", key: "forge" },
      { label: "Forge Lite", href: "/forge-lite.html", key: "forge-lite" },
      { label: "Guardian", href: "/guardian.html", key: "guardian" },
      { label: "Personal AI", href: "/personal-ai.html", key: "personal-ai" },
      { label: "SentinelOS", href: "/sentinelos.html", key: "sentinelos" },
      { label: "Sentinel X", href: "/sentinel-x.html", key: "sentinel-x" }
    ]
  },
  { label: "SentinelAI", href: "/sentinelai.html", key: "sentinelai" },
  { label: "SentinelWeb", href: "/sentinelweb.html", key: "sentinelweb" },
  { label: "Demos", href: "/index.html#demos", key: "demos" },
  { label: "Story", href: "/story.html", key: "story" },
  { label: "Pricing", href: "/pricing.html", key: "pricing" },
  { label: "Contact", href: "/contact.html", key: "contact" }
];

window.PRODUCT_ITEMS = [
  { label: "SentinelAI", href: "/sentinelai.html", key: "sentinelai", status: "Core" },
  { label: "SentinelWeb", href: "/sentinelweb.html", key: "sentinelweb", status: "Private Beta" },
  { label: "SentinelOS", href: "/sentinelos.html", key: "sentinelos", status: "Building" },
  { label: "Sentinel X", href: "/sentinel-x.html", key: "sentinel-x", status: "Coming Soon" },
  { label: "Personal AI", href: "/personal-ai.html", key: "personal-ai", status: "Available" },
  { label: "Guardian", href: "/guardian.html", key: "guardian", status: "Coming Soon" },
  { label: "Forge", href: "/forge.html", key: "forge", status: "Coming Soon" },
  { label: "Forge Lite", href: "/forge-lite.html", key: "forge-lite", status: "Coming Soon" }
];

window.THEME_TOKENS = {
  background: "#000000",
  primaryAccent: "#00d4ff",
  secondaryAccent: "#cc0000",
  cardColor: "rgba(255, 255, 255, 0.045)",
  borderColor: "rgba(255, 255, 255, 0.10)",
  glowColor: "rgba(0, 212, 255, 0.36)",
  textColor: "#ffffff",
  mutedText: "#9aa3ad",
  buttonStyle: "cyan-gradient"
};

window.DEMO_LINKS = {
  ordering: "https://oodemo.sentinelprime.org"
};

window.DEMOS = [
  {
    title: "Online Ordering System",
    description: "Full restaurant system with ordering, payments, rewards, and admin dashboard.",
    link: window.DEMO_LINKS.ordering,
    live: true,
    note: "Live demo - updates frequently"
  },
  {
    title: "CRM System",
    description: "Manage leads, clients, and automation.",
    live: false
  },
  {
    title: "Scheduling System",
    description: "Booking and scheduling for service businesses.",
    live: false
  }
];
