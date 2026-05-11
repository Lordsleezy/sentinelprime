const navItems = [
  { label: "Home", href: "/index.html", key: "home" },
  { label: "Products", href: "/products.html", key: "products" },
  { label: "SentinelOS", href: "/products.html#sentineloscoming-soon", key: "sentinelos" },
  { label: "About", href: "/about.html", key: "about" },
  { label: "Business Services", href: "/business-services.html", key: "services" },
  { label: "Contact", href: "/contact.html", key: "contact" },
  { label: "Try Sentinel", href: "/jarvis-app.html", key: "jarvis", tryCta: true }
];

function navLinkClass(item, activePage) {
  const parts = [];
  if (item.tryCta) parts.push("landing-nav__link--try");
  if (item.key === "home" && activePage === "home") parts.push("active");
  if (item.key === "products" && activePage === "products") parts.push("active");
  if (item.key === "about" && activePage === "about") parts.push("active");
  if (item.key === "services" && activePage === "services") parts.push("active");
  if (item.key === "contact" && activePage === "contact") parts.push("active");
  if (item.key === "jarvis" && activePage === "jarvis") parts.push("active");
  return parts.join(" ").trim();
}

function desktopNavHTML(activePage) {
  return navItems
    .map((item) => {
      const cls = navLinkClass(item, activePage);
      return `<a class="${cls}" href="${item.href}">${item.label}</a>`;
    })
    .join("");
}

function navLinksHTML(activePage) {
  return navItems
    .map((item) => {
      const cls = navLinkClass(item, activePage);
      return `<a class="${cls}" href="${item.href}">${item.label}</a>`;
    })
    .join("");
}

function renderHeaderFooter() {
  const pageKey = document.body.dataset.page || "home";
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");

  if (header) {
    header.innerHTML = `
      <header class="landing-nav" id="landing-nav">
        <a class="landing-nav__brand" href="/index.html" aria-label="Sentinel Prime home">
          <img src="/assets/logo-tesseract.svg" width="36" height="36" alt="">
          <span>SENTINEL PRIME</span>
        </a>
        <nav class="landing-nav__links" aria-label="Primary">${desktopNavHTML(pageKey)}</nav>
        <div class="landing-nav__menu">
          <button type="button" class="nav-menu-btn" id="menu-toggle" aria-label="Open menu" aria-expanded="false">☰</button>
        </div>
      </header>
      <nav class="nav-mobile" id="nav-mobile" aria-label="Mobile">${navLinksHTML(pageKey)}</nav>
    `;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="il-footer">
        <nav class="il-footer__links" aria-label="Footer">
          <a href="/privacy.html">Privacy Policy</a>
          <a href="/contact.html">Contact</a>
        </nav>
        <p class="il-footer__tag">Sentinal Prime Inc. 2026 — Building what big tech won't</p>
      </footer>
    `;
  }
}

renderHeaderFooter();
