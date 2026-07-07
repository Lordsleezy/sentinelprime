(function () {
  "use strict";

  if (document.body.dataset.skipShell === "true" || document.getElementById("intro")) return;

  if (!document.getElementById("galaxy-canvas")) {
    var canvas = document.createElement("canvas");
    canvas.id = "galaxy-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    if (!document.querySelector(".space-vignette")) {
      var vignette = document.createElement("div");
      vignette.className = "space-vignette";
      document.body.insertBefore(vignette, canvas.nextSibling);
    }
  }

  var legacyNav = document.querySelector("nav.nav:not(.global-nav)");
  if (legacyNav && !document.getElementById("global-nav")) {
    var mount = document.createElement("div");
    mount.id = "global-nav-mount";
    legacyNav.replaceWith(mount);
    var navScript = document.createElement("script");
    navScript.src = "/js/global-nav.js";
    document.body.appendChild(navScript);
  }

  function loadGalaxy() {
    if (window.__sentinelGalaxyInit) return;

    function appendScript(src, onload) {
      var script = document.createElement("script");
      script.src = src;
      script.defer = true;
      if (onload) script.onload = onload;
      document.body.appendChild(script);
    }

    appendScript("/js/galaxy-background.js");
  }

  if (!document.querySelector('link[href*="galaxy-shell"]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/css/galaxy-shell.css";
    document.head.appendChild(link);
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadGalaxy, { timeout: 2200 });
  } else {
    window.setTimeout(loadGalaxy, 1200);
  }
})();
