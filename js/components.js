const fallbackNavItems = [
  { label: "Home", href: "/index.html", key: "home" },
  {
    label: "Products",
    href: "/products.html",
    key: "products",
    children: [
      { label: "Forge", href: "/forge.html", key: "forge" },
      { label: "Forge Lite", href: "/forge-lite.html", key: "forge-lite" },
      { label: "Guardian", href: "/guardian.html", key: "guardian" },
      { label: "Personal AI", href: "/personal-ai.html", key: "personal-ai" }
    ]
  },
  { label: "SentinelAI", href: "/sentinelai.html", key: "sentinelai" },
  { label: "SentinelWeb", href: "/sentinelweb.html", key: "sentinelweb" },
  { label: "Story", href: "/story.html", key: "story" },
  { label: "Pricing", href: "/pricing.html", key: "pricing" },
  { label: "Contact", href: "/contact.html", key: "contact" }
];

const navItems = Array.isArray(window.NAV_ITEMS) ? window.NAV_ITEMS : fallbackNavItems;

function navLinkClass(item, activePage) {
  const parts = [];
  if (item.tryCta) parts.push("landing-nav__link--try");
  if (item.key === activePage) parts.push("active");
  if (Array.isArray(item.children) && item.children.some((child) => child.key === activePage)) parts.push("active");
  if (activePage === "products" && ["sentinelos", "sentinel-x", "forge", "forge-lite", "guardian", "personal-ai"].includes(item.key)) {
    parts.push("active");
  }
  return parts.join(" ").trim();
}

function navItemHTML(item, activePage) {
  const cls = navLinkClass(item, activePage);
  if (Array.isArray(item.children) && item.children.length > 0) {
    const childLinks = item.children
      .map((child) => `<a class="${navLinkClass(child, activePage)}" href="${child.href}">${child.label}</a>`)
      .join("");
    return `
      <div class="landing-nav__dropdown">
        <a class="${cls}" href="${item.href}">${item.label}</a>
        <div class="landing-nav__dropdown-menu">${childLinks}</div>
      </div>
    `;
  }
  return `<a class="${cls}" href="${item.href}">${item.label}</a>`;
}

function desktopNavHTML(activePage) {
  return navItems
    .map((item) => navItemHTML(item, activePage))
    .join("");
}

function navLinksHTML(activePage) {
  return navItems
    .map((item) => {
      const cls = navLinkClass(item, activePage);
      const children = Array.isArray(item.children)
        ? item.children.map((child) => `<a class="nav-mobile__child ${navLinkClass(child, activePage)}" href="${child.href}">${child.label}</a>`).join("")
        : "";
      return `<a class="${cls}" href="${item.href}">${item.label}</a>${children}`;
    })
    .join("");
}

function renderHeaderFooter() {
  const pageKey = document.body.dataset.page || "home";
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const brandName = window.BRAND_NAME || "SENTINEL PRIME";

  if (header) {
    header.innerHTML = `
      <header class="landing-nav" id="landing-nav">
        <a class="landing-nav__brand" href="/index.html" aria-label="${brandName} home">
          <img src="/assets/logo-tesseract.svg" width="36" height="36" alt="">
          <span>${brandName}</span>
        </a>
        <nav class="landing-nav__links" aria-label="Primary">${desktopNavHTML(pageKey)}</nav>
        <div class="landing-nav__menu">
          <button type="button" class="nav-menu-btn" id="menu-toggle" aria-label="Open menu" aria-expanded="false">&#9776;</button>
        </div>
      </header>
      <nav class="nav-mobile" id="nav-mobile" aria-label="Mobile">${navLinksHTML(pageKey)}</nav>
    `;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="il-footer">
        <nav class="il-footer__links" aria-label="Footer">
          <a href="/story.html">Our Story</a>
          <a href="/privacy.html">Privacy Policy</a>
          <a href="/sentinelweb.html">SentinelWeb</a>
          <a href="/contact.html">Contact</a>
        </nav>
        <p class="il-footer__tag">Sentinel Prime Inc. 2026 - Building what big tech won't</p>
      </footer>
    `;
  }
}

renderHeaderFooter();
