const navItems = [
  { label: "Products", href: "/index.html#ecosystem", key: "products" },
  { label: "SentinelOS", href: "/index.html#sentinel-os", key: "sentinelos" },
  { label: "About", href: "/index.html#about", key: "about" },
  { label: "Business Services", href: "/index.html#business", key: "services" },
  { label: "Contact", href: "/contact.html", key: "contact" }
];

function navActiveClass(itemKey, activePage) {
  if (itemKey === "services" && activePage === "services") return "active";
  if (itemKey === "contact" && activePage === "contact") return "active";
  return "";
}

function desktopNavHTML(activePage) {
  return navItems
    .map((item) => {
      const activeClass = navActiveClass(item.key, activePage);
      return `<a class="${activeClass}" href="${item.href}">${item.label}</a>`;
    })
    .join("");
}

function navLinksHTML(activePage) {
  return navItems
    .map((item) => {
      const activeClass = navActiveClass(item.key, activePage);
      return `<a class="${activeClass}" href="${item.href}">${item.label}</a>`;
    })
    .join("");
}

function renderHeaderFooter() {
  const pageKey = document.body.dataset.page || "home";
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const logoActive = pageKey === "home" ? " logo-home-active" : "";

  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="container nav-wrap">
          <a class="logo${logoActive}" href="/index.html" aria-label="Sentinel Prime home">
            <span class="logo-mark"><img src="/assets/logo-tesseract.svg" width="34" height="34" alt="" /></span>
            <span class="logo-text">Sentinel Prime</span>
          </a>
          <nav class="nav-links" aria-label="Primary">${desktopNavHTML(pageKey)}</nav>
          <div class="nav-right">
            <button class="menu-btn" id="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false">☰</button>
          </div>
        </div>
        <div class="container mobile-nav" id="mobile-nav">${navLinksHTML(pageKey)}</div>
      </header>
    `;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer site-footer--minimal">
        <div class="container footer-minimal">
          <nav class="footer-minimal-links" aria-label="Footer">
            <a href="https://github.com/Lordsleezy/sentinelprime" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="/privacy.html">Privacy Policy</a>
            <a href="/contact.html">Contact</a>
          </nav>
          <p class="copyright">Sentinal Prime Inc. 2026 — Building what big tech won’t</p>
        </div>
      </footer>
    `;
  }
}

renderHeaderFooter();
