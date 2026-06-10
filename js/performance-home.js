(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = window.matchMedia("(max-width: 820px)").matches;

  function onIdle(callback) {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout: 2200 });
    } else {
      window.setTimeout(callback, 1200);
    }
  }

  function revealAnimatedSections() {
    var animated = document.querySelectorAll(".home-products-grid, .products-grid, .home-market-panel");
    if (!animated.length || reduceMotion) return;

    document.body.classList.add("animations-ready");

    if (!("IntersectionObserver" in window)) {
      animated.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "120px 0px" });

    animated.forEach(function (el) { observer.observe(el); });
  }

  function loadScript(src, callback) {
    var script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.onload = callback;
    document.head.appendChild(script);
  }

  function loadGalaxyAfterIdle() {
    if (reduceMotion || isMobile || document.hidden) return;
    var canvas = document.getElementById("galaxy-canvas");
    if (!canvas) return;

    onIdle(function () {
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js", function () {
        loadScript("js/galaxy-background.js");
      });
    });
  }

  revealAnimatedSections();
  loadGalaxyAfterIdle();
})();
