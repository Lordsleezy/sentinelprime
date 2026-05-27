(function () {
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

  let scrollTimer = 0;
  let scrollFrame = 0;
  function markScrolling() {
    if (!scrollFrame) {
      scrollFrame = window.requestAnimationFrame(() => {
        document.body.classList.add("is-scrolling");
        scrollFrame = 0;
      });
    }
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      document.body.classList.remove("is-scrolling");
    }, 180);
  }
  window.addEventListener("scroll", markScrolling, { passive: true });

  const revealEls = document.querySelectorAll(".il-reveal");
  if (revealEls.length) {
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add("il-reveal--in");
          ro.unobserve(en.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
    );
    revealEls.forEach((el) => ro.observe(el));
  }
})();
