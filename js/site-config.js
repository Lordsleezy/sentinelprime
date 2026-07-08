window.SITE_NAME = "Sentinel Prime";
window.BRAND_NAME = "SENTINEL PRIME";

window.API_BASES = {
  sentinelweb: "https://sentinelweb-production-1d18.up.railway.app"
};

window.SENTINELWEB_API_BASE = window.API_BASES.sentinelweb;

window.NAV_ITEMS = [
  { label: "Shift", href: "/products#shift", key: "shift" },
  { label: "Guardian", href: "/guardian", key: "guardian" },
  { label: "Prospects", href: "https://prospects.sentinelprime.org", key: "prospects" },
  { label: "Finance", href: "https://finance.sentinelprime.org", key: "finance" },
  { label: "Care", href: "/care", key: "care" },
  { label: "Contact", href: "/contact", key: "contact" }
];

window.PRODUCT_ITEMS = [
  { label: "Shift", href: "/products#shift", key: "shift", status: "Available" },
  { label: "Guardian", href: "/guardian", key: "guardian", status: "Available" },
  { label: "Prospects", href: "https://prospects.sentinelprime.org", key: "prospects", status: "Available" },
  { label: "Finance", href: "https://finance.sentinelprime.org", key: "finance", status: "Available" },
  { label: "Care", href: "/care", key: "care", status: "Available" }
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
