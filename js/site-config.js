window.SITE_NAME = "Sentinel Prime";
window.BRAND_NAME = "SENTINEL PRIME";

window.API_BASES = {
  sentinelweb: "https://sentinelweb-production-1d18.up.railway.app"
};

window.SENTINELWEB_API_BASE = window.API_BASES.sentinelweb;

window.NAV_ITEMS = [
  { label: "Home", href: "/index.html", key: "home" },
  { label: "Sentinel AI", href: "/sentinel-ai", key: "sentinelai" },
  { label: "Sentinel Drive", href: "/sentinel-drive", key: "sentinel-drive" },
  { label: "Pricing", href: "/pricing.html", key: "pricing" },
  { label: "Download", href: "/download", key: "download" },
  { label: "About", href: "/about", key: "about" },
  { label: "Contact", href: "/contact", key: "contact" },
  { label: "Start Free Trial", href: "/download", key: "trial", tryCta: true }
];

window.PRODUCT_ITEMS = [
  { label: "Sentinel AI", href: "/sentinel-ai", key: "sentinelai", status: "Core" },
  { label: "Sentinel Drive", href: "/sentinel-drive", key: "sentinel-drive", status: "Coming Soon" },
  { label: "Personal AI", href: "/personal-ai.html", key: "personal-ai", status: "Available" }
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
