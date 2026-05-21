/**
 * Lazy-loads the product galaxy when in view.
 * Reduced-motion users get a single static frame (handled inside galaxy.js).
 */
(function initGalaxyLoader() {
  const roots = document.querySelectorAll("[data-galaxy-root]");
  if (!roots.length) return;

  const initialized = new WeakSet();

  function loadGalaxy(root) {
    if (initialized.has(root)) return;
    initialized.add(root);
    import("./galaxy.js")
      .then((mod) => {
        try {
          mod.initGalaxy(root);
        } catch (err) {
          console.error("[galaxy] initGalaxy threw:", err);
        }
      })
      .catch((err) => console.error("[galaxy] failed to load module:", err));
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
