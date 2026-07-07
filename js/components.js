const fallbackNavItems = [
  { label: "Shift", href: "/products#shift", key: "shift" },
  { label: "Guardian", href: "/guardian", key: "guardian" },
  { label: "Prospects", href: "https://prospects.sentinelprime.org", key: "prospects" },
  { label: "Care", href: "/care", key: "care" },
  { label: "Contact", href: "/contact", key: "contact" }
];

const navItems = Array.isArray(window.NAV_ITEMS) ? window.NAV_ITEMS : fallbackNavItems;

function navLinkClass(item, activePage) {
  const parts = [];
  if (item.tryCta) parts.push("landing-nav__link--try");
  if (item.key === activePage) parts.push("active");
  if (Array.isArray(item.children) && item.children.some((child) => child.key === activePage)) parts.push("active");
  return parts.join(" ").trim();
}

function navItemHTML(item, activePage) {
  const cls = navLinkClass(item, activePage);
  const accountAttr = item.key === "account" ? ' data-account-link="true"' : "";
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
  return `<a class="${cls}" href="${item.href}"${accountAttr}>${item.label}</a>`;
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
          <a href="/privacy">Privacy Policy</a>
          <a href="/sentinelweb.html">SentinelWeb</a>
          <a href="/contact.html">Contact</a>
        </nav>
        <p class="il-footer__tag">Sentinel Prime Inc. &middot; Founded 2024 &middot; Established 2026</p>
      </footer>
    `;
  }
}

renderHeaderFooter();

fetch("/api/account", { credentials: "same-origin" })
  .then((response) => {
    if (!response.ok) return;
    document.querySelectorAll("[data-account-link]").forEach((link) => {
      link.href = "/account";
      link.textContent = "My Account";
    });
  })
  .catch(() => {});
