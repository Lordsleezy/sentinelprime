/**
 * Lazy-loads the product galaxy when in view.
 * Skips entirely when prefers-reduced-motion is set.
 */
(function initGalaxyLoader() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const roots = document.querySelectorAll("[data-galaxy-root]");
  if (!roots.length) return;

  const initialized = new WeakSet();

  function loadGalaxy(root) {
    if (initialized.has(root)) return;
    initialized.add(root);
    import("./galaxy.js")
      .then((mod) => mod.initGalaxy(root))
      .catch((err) => console.warn("Galaxy failed to load:", err));
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadGalaxy(entry.target);
          io.disconnect();
          break;
        }
      }
    },
    { rootMargin: "120px", threshold: 0.01 }
  );

  for (const root of roots) io.observe(root);
})();
