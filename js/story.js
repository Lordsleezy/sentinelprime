(function initStoryPage() {
  if (document.body.dataset.page !== "story") return;

  const progressBar = document.querySelector(".story-progress__bar");
  const navLinks = document.querySelectorAll(".story-nav__list a");
  const sections = [...document.querySelectorAll(".story-section[id], .story-hero[id]")];
  const revealEls = document.querySelectorAll(".story-reveal, .story-timeline__item, .story-tower");

  function onScroll() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar && docHeight > 0) {
      progressBar.style.width = `${Math.min(100, (scrollTop / docHeight) * 100)}%`;
    }

    let activeId = sections[0]?.id;
    for (const section of sections) {
      if (scrollTop >= section.offsetTop - 120) activeId = section.id;
    }
    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
    });
  }

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
