const demosGrid = document.getElementById("demos-grid");
const siteDemos = Array.isArray(window.DEMOS) ? window.DEMOS : [];
const heroEvents = document.querySelectorAll("[data-hero-event]");
const activityFeed = document.getElementById("activity-feed");
const liveActivityMessages = [
  "New lead from Elk Grove",
  "Fence quote requested",
  "Order placed - $89",
  "AI assistant qualified a new prospect",
  "Booking request received from Sacramento",
  "New system inquiry from Roseville"
];

const scrollRevealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
      }
    });
  },
  { threshold: 0.15 }
);

if (demosGrid && siteDemos.length > 0) {
  demosGrid.innerHTML = siteDemos
    .map((demo) => {
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
    })
    .join("");
}

if (heroEvents.length > 0) {
  let activeHeroEvent = 0;

  window.setInterval(() => {
    heroEvents[activeHeroEvent].classList.remove("active");
    activeHeroEvent = (activeHeroEvent + 1) % heroEvents.length;
    heroEvents[activeHeroEvent].classList.add("active");
  }, 2400);
}

if (activityFeed) {
  const showActivityToast = () => {
    const toast = document.createElement("div");
    toast.className = "activity-toast";
    toast.textContent = liveActivityMessages[Math.floor(Math.random() * liveActivityMessages.length)];
    activityFeed.innerHTML = "";
    activityFeed.appendChild(toast);

    window.requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => {
        if (activityFeed.contains(toast)) {
          activityFeed.removeChild(toast);
        }
      }, 450);
    }, 3600);
  };

  showActivityToast();
  window.setInterval(showActivityToast, 5200);
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

document.querySelectorAll(".fade-in").forEach((el) => scrollRevealObserver.observe(el));
document.querySelectorAll(".reveal").forEach((el) => scrollRevealObserver.observe(el));
