(function () {
  const nav = document.getElementById("landing-nav");
  const menuBtn = document.getElementById("nav-menu-btn");
  const mobileNav = document.getElementById("nav-mobile");

  function onScroll() {
    if (!nav) return;
    nav.classList.toggle("landing-nav--scrolled", window.scrollY > 32);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener("click", () => {
      const open = mobileNav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  const cycleEl = document.getElementById("hero-cycle");
  const phrases = ["Private.", "Powerful.", "Yours."];
  let ci = 0;
  if (cycleEl) {
    function cycle() {
      cycleEl.classList.remove("hero-cycle--visible");
      window.setTimeout(() => {
        ci = (ci + 1) % phrases.length;
        cycleEl.textContent = phrases[ci];
        cycleEl.classList.add("hero-cycle--visible");
      }, 420);
    }
    cycleEl.classList.add("hero-cycle--visible");
    window.setInterval(cycle, 2800);
  }

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      if (mobileNav) mobileNav.classList.remove("open");
      if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
    });
  });

  const statPrivate = document.getElementById("stat-private");
  const statData = document.getElementById("stat-data");
  let statsDone = false;

  function runCounters() {
    if (statsDone || !statPrivate || !statData) return;
    statsDone = true;
    const dur = 1600;
    const t0 = performance.now();

    function easeOut(t) {
      return 1 - (1 - t) ** 3;
    }

    function frame(now) {
      const u = Math.min(1, (now - t0) / dur);
      const e = easeOut(u);
      statPrivate.textContent = `${Math.round(100 * e)}`;
      statData.textContent = "0";
      if (u < 1) requestAnimationFrame(frame);
      else {
        statPrivate.textContent = "100";
        statData.textContent = "0";
      }
    }
    requestAnimationFrame(frame);
  }

  const statsBar = document.getElementById("stats-bar");
  if (statsBar) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) runCounters();
        });
      },
      { threshold: 0.35 }
    );
    io.observe(statsBar);
  }

  const revealEls = document.querySelectorAll(".il-reveal");
  if (revealEls.length) {
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) en.target.classList.add("il-reveal--in");
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => ro.observe(el));
  }
})();
