const menuToggle = document.getElementById("menu-toggle");
const mobileNav = document.getElementById("mobile-nav");
const yearEl = document.getElementById("year");
const demosGrid = document.getElementById("demos-grid");

if (menuToggle && mobileNav) {
  menuToggle.addEventListener("click", () => {
    mobileNav.classList.toggle("open");
  });
}

if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

if (demosGrid && Array.isArray(DEMOS)) {
  demosGrid.innerHTML = DEMOS.map((demo) => {
    const isLive = Boolean(demo.live && demo.link);

    return `
      <article class="card demo-card reveal">
        <div class="demo-card-head">
          <h2>${demo.title}</h2>
          ${!isLive ? '<span class="plan-badge demo-coming-soon">Coming Soon</span>' : ""}
        </div>
        <p>${demo.description}</p>
        <div class="demo-card-actions">
          ${isLive ? `<a class="btn btn-primary" href="${demo.link}" target="_blank" rel="noopener noreferrer">View Demo</a>` : ""}
          ${isLive ? `<p class="demo-note">${demo.note || "Live demo - updates frequently"}</p>` : ""}
        </div>
      </article>
    `;
  }).join("");
}

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetId = link.getAttribute("href");
    if (!targetId || targetId === "#") return;
    const targetEl = document.querySelector(targetId);
    if (!targetEl) return;
    event.preventDefault();
    targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const revealEls = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);

revealEls.forEach((el) => observer.observe(el));
