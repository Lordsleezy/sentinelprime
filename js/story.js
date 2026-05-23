(function initStoryPage() {
  if (document.body.dataset.page !== "story") return;

  const progressBar = document.querySelector(".story-progress__bar");
  const navLinks = document.querySelectorAll(".story-nav__list a");
  const sections = [...document.querySelectorAll(".story-section[id], .story-hero[id]")];
  const revealEls = document.querySelectorAll(".story-reveal, .story-timeline__item, .story-tower");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.innerWidth < 768;

  function onScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar && docHeight > 0) {
      progressBar.style.width = `${Math.min(100, (scrollTop / docHeight) * 100)}%`;
    }

    const offset = isMobile() ? 96 : 120;
    let activeId = sections[0]?.id;
    for (const section of sections) {
      if (scrollTop >= section.offsetTop - offset) activeId = section.id;
    }
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
    });
  }

  if (!reducedMotion) {
    const rootMargin = isMobile() ? "0px 0px -4% 0px" : "0px 0px -8% 0px";
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        }
      },
      { rootMargin, threshold: isMobile() ? 0.04 : 0.08 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href")?.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  onScroll();
})();
