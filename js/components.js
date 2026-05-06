const siteDemoLinks = window.DEMO_LINKS || {
  ordering: "https://oodemo.sentinelprime.org"
};

const navItems = [
  { label: "Home", href: "/", key: "home" },
  { label: "Services", href: "/services.html", key: "services" },
  { label: "Demos", href: "/demos", key: "demos" },
  { label: "Case Study", href: "/case-study.html", key: "case-study" },
  { label: "Pricing", href: "/pricing.html", key: "pricing" },
  { label: "Jarvis", href: "/jarvis.html", key: "jarvis" },
  { label: "Contact", href: "/contact.html", key: "contact" }
];

function desktopNavHTML(activePage) {
  return navItems
    .map((item) => {
      const activeClass = item.key === activePage ? "active" : "";

      if (item.key === "demos") {
        return `
          <div class="nav-dropdown">
            <a class="${activeClass}" href="${item.href}">${item.label}</a>
            <div class="nav-dropdown-menu" aria-label="Demos submenu">
              <a href="${siteDemoLinks.ordering}" target="_blank" rel="noopener noreferrer">Online Ordering</a>
            </div>
          </div>
        `;
      }

      return `<a class="${activeClass}" href="${item.href}">${item.label}</a>`;
    })
    .join("");
}

function navLinksHTML(activePage) {
  return navItems
    .map((item) => {
      const activeClass = item.key === activePage ? "active" : "";
      return `<a class="${activeClass}" href="${item.href}">${item.label}</a>`;
    })
    .join("");
}

function renderHeaderFooter() {
  const pageKey = document.body.dataset.page || "home";
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");

  if (header) {
    header.innerHTML = `
      <header class="site-header">
        <div class="container nav-wrap">
          <a class="logo" href="/">Sentinel Prime</a>
          <nav class="nav-links">${desktopNavHTML(pageKey)}</nav>
          <div class="nav-right">
            <button class="menu-btn" id="menu-toggle" aria-label="Open menu">☰</button>
          </div>
        </div>
        <div class="container mobile-nav" id="mobile-nav">${navLinksHTML(pageKey)}</div>
      </header>
    `;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-grid">
          <div>
            <h3>Sentinel Prime</h3>
            <p>Digital and technical systems engineered to help businesses operate better and scale with confidence.</p>
          </div>
          <div>
            <h3>Quick Links</h3>
            <div class="footer-links">${navLinksHTML(pageKey)}</div>
          </div>
          <div>
            <h3>Contact</h3>
            <p><a href="mailto:customerservice@sentinelprime.org">customerservice@sentinelprime.org</a></p>
            <p>Serving local businesses across multiple service markets.</p>
          </div>
        </div>
        <div class="container">
          <p class="copyright">© <span id="year"></span> Sentinel Prime. All rights reserved.</p>
        </div>
      </footer>
    `;
  }
}

renderHeaderFooter();
