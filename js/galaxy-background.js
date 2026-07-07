(function () {
  "use strict";

  if (window.__sentinelGalaxyInit) return;
  window.__sentinelGalaxyInit = true;

  var canvas = document.getElementById("galaxy-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "galaxy-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
  }

  if (!document.querySelector(".space-vignette")) {
    var vignette = document.createElement("div");
    vignette.className = "space-vignette";
    document.body.insertBefore(vignette, canvas.nextSibling);
  }

  document.body.classList.add("has-galaxy-canvas");

  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  var state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    running: true,
    pulseCooldown: 0,
    pointer: { x: 0, y: 0 },
    pointerTarget: { x: 0, y: 0 },
    layers: [],
    nebulae: []
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function starCount(multiplier, min, max) {
    var area = state.width * state.height;
    return Math.round(clamp(area / multiplier, min, max));
  }

  function makeStar(layer) {
    return {
      x: Math.random() * state.width,
      y: Math.random() * state.height,
      r: rand(layer.radius[0], layer.radius[1]),
      alpha: rand(layer.alpha[0], layer.alpha[1]),
      phase: rand(0, Math.PI * 2),
      twinkle: rand(layer.twinkle[0], layer.twinkle[1]),
      drift: rand(layer.drift[0], layer.drift[1]),
      pulse: 0,
      hue: Math.random() < 0.72 ? "255,255,255" : (Math.random() < 0.5 ? "176,245,255" : "115,255,232")
    };
  }

  function rebuildScene() {
    var mobile = state.width < 760 || coarsePointer;
    var density = reduceMotion ? 2.8 : (mobile ? 1.55 : 1);

    var specs = [
      {
        name: "far",
        count: starCount(1450 * density, mobile ? 420 : 900, mobile ? 780 : 1800),
        radius: [0.35, 0.95],
        alpha: [0.18, 0.5],
        twinkle: [0.0009, 0.0022],
        drift: [0.002, 0.006],
        parallax: mobile ? 0.6 : 1.2
      },
      {
        name: "mid",
        count: starCount(3100 * density, mobile ? 160 : 430, mobile ? 360 : 880),
        radius: [0.55, 1.45],
        alpha: [0.2, 0.68],
        twinkle: [0.0015, 0.0033],
        drift: [0.004, 0.012],
        parallax: mobile ? 1.1 : 2.7
      },
      {
        name: "near",
        count: starCount(8200 * density, mobile ? 58 : 140, mobile ? 140 : 340),
        radius: [0.8, 2.25],
        alpha: [0.18, 0.82],
        twinkle: [0.002, 0.0045],
        drift: [0.006, 0.02],
        parallax: mobile ? 1.8 : 4.8
      }
    ];

    state.layers = specs.map(function (spec) {
      var stars = [];
      for (var i = 0; i < spec.count; i += 1) stars.push(makeStar(spec));
      return Object.assign({}, spec, { stars: stars });
    });

    state.nebulae = [
      { x: 0.22, y: 0.28, size: 0.82, color: "0,212,255", alpha: 0.11, speed: 0.00008, phase: rand(0, 7) },
      { x: 0.72, y: 0.42, size: 0.68, color: "20,184,166", alpha: 0.09, speed: 0.00011, phase: rand(0, 7) },
      { x: 0.5, y: 0.72, size: 1.05, color: "50,255,214", alpha: 0.055, speed: 0.00006, phase: rand(0, 7) }
    ];
  }

  function resize() {
    state.width = window.innerWidth || document.documentElement.clientWidth || 1;
    state.height = window.innerHeight || document.documentElement.clientHeight || 1;
    state.dpr = Math.min(window.devicePixelRatio || 1, state.width < 760 ? 1.45 : 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = state.width + "px";
    canvas.style.height = state.height + "px";
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    rebuildScene();
  }

  function drawNebula(time) {
    state.nebulae.forEach(function (nebula) {
      var driftX = Math.sin(time * nebula.speed + nebula.phase) * 36;
      var driftY = Math.cos(time * nebula.speed * 0.7 + nebula.phase) * 24;
      var x = state.width * nebula.x + driftX;
      var y = state.height * nebula.y + driftY;
      var r = Math.max(state.width, state.height) * nebula.size;
      var gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, "rgba(" + nebula.color + "," + nebula.alpha + ")");
      gradient.addColorStop(0.38, "rgba(" + nebula.color + "," + nebula.alpha * 0.34 + ")");
      gradient.addColorStop(1, "rgba(" + nebula.color + ",0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, state.width, state.height);
    });
  }

  function drawStars(time) {
    state.pointer.x += (state.pointerTarget.x - state.pointer.x) * 0.035;
    state.pointer.y += (state.pointerTarget.y - state.pointer.y) * 0.035;

    state.layers.forEach(function (layer) {
      var px = state.pointer.x * layer.parallax;
      var py = state.pointer.y * layer.parallax;
      ctx.save();
      ctx.translate(px, py);

      layer.stars.forEach(function (star) {
        if (!reduceMotion) {
          star.x += star.drift;
          star.y += star.drift * 0.12;
          if (star.x > state.width + 8) star.x = -8;
          if (star.y > state.height + 8) star.y = -8;
        }

        var shimmer = reduceMotion ? 0.86 : 0.72 + Math.sin(time * star.twinkle + star.phase) * 0.28;
        if (star.pulse > 0) {
          star.pulse *= 0.94;
          shimmer += star.pulse * 1.4;
        }
        var alpha = clamp(star.alpha * shimmer, 0.05, 1);
        var radius = star.r * (1 + star.pulse * 1.9);

        ctx.beginPath();
        ctx.fillStyle = "rgba(" + star.hue + "," + alpha + ")";
        ctx.shadowBlur = radius > 1.4 || star.pulse > 0.05 ? 10 + star.pulse * 22 : 0;
        ctx.shadowColor = "rgba(77,245,230," + alpha + ")";
        ctx.arc(star.x, star.y, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    });
    ctx.shadowBlur = 0;
  }

  function pulseRandomStar(delta) {
    if (reduceMotion || !state.layers.length) return;
    state.pulseCooldown -= delta;
    if (state.pulseCooldown > 0) return;
    state.pulseCooldown = rand(2800, 6800);
    var layer = state.layers[Math.floor(rand(1, state.layers.length))] || state.layers[0];
    var star = layer.stars[Math.floor(Math.random() * layer.stars.length)];
    if (star) star.pulse = rand(0.75, 1);
  }

  var lastFrame = performance.now();
  function render(now) {
    if (!state.running) return;
    var delta = Math.min(48, now - lastFrame);
    lastFrame = now;
    state.time += delta;

    var background = ctx.createLinearGradient(0, 0, state.width, state.height);
    background.addColorStop(0, "#000005");
    background.addColorStop(0.48, "#020812");
    background.addColorStop(1, "#000005");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, state.width, state.height);

    drawNebula(state.time);
    pulseRandomStar(delta);
    drawStars(state.time);
    window.requestAnimationFrame(render);
  }

  function onPointerMove(event) {
    if (reduceMotion) return;
    state.pointerTarget.x = ((event.clientX / state.width) - 0.5) * 2;
    state.pointerTarget.y = ((event.clientY / state.height) - 0.5) * 2;
  }

  function onVisibilityChange() {
    state.running = !document.hidden;
    if (state.running) {
      lastFrame = performance.now();
      window.requestAnimationFrame(render);
    }
  }

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", function () {
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    state.running = false;
  });

  resize();
  window.requestAnimationFrame(render);
})();
