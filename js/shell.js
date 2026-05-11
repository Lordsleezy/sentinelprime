(function () {
  function initNavScroll() {
    const nav = document.getElementById("landing-nav");
    if (!nav) return;
    function onScroll() {
      nav.classList.toggle("landing-nav--scrolled", window.scrollY > 32);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initMenu() {
    const menuToggle = document.getElementById("menu-toggle");
    const mobileNav = document.getElementById("nav-mobile");
    if (!menuToggle || !mobileNav) return;
    menuToggle.addEventListener("click", () => {
      const open = mobileNav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function initSamePageAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        const mobileNav = document.getElementById("nav-mobile");
        const menuToggle = document.getElementById("menu-toggle");
        if (mobileNav) mobileNav.classList.remove("open");
        if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  initNavScroll();
  initMenu();
  initSamePageAnchors();
})();
