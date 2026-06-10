(function () {
  "use strict";

  if (window.__sentinelGalaxyInit) return;
  window.__sentinelGalaxyInit = true;

  if (!window.THREE) return;

  var isMobile = window.matchMedia("(max-width: 800px)").matches;
  var canvas = document.getElementById("galaxy-canvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "galaxy-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    if (!document.querySelector(".space-vignette")) {
      var vignette = document.createElement("div");
      vignette.className = "space-vignette";
      document.body.insertBefore(vignette, canvas.nextSibling);
    }
  }

  document.body.classList.add("has-galaxy-canvas");

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 6000);
  camera.position.z = 980;
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000005, 1);

  var mouse = { x: 0, y: 0 };
  var target = { x: 0, y: 0 };

  function makeGlowTexture(inner, outer) {
    var c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, inner);
    g.addColorStop(0.18, inner);
    g.addColorStop(0.48, outer);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  var galaxy = new THREE.Group();
  scene.add(galaxy);

  var count = isMobile ? 6500 : 18000;
  var geo = new THREE.BufferGeometry();
  var pos = new Float32Array(count * 3);
  var col = new Float32Array(count * 3);
  var core = new THREE.Color(0xff9944);
  var white = new THREE.Color(0xffffff);
  var blue = new THREE.Color(0xcce8ff);
  var deep = new THREE.Color(0x214a86);

  for (var i = 0; i < count; i++) {
    var arm = i % 4;
    var radius = Math.pow(Math.random(), 0.54) * 960;
    var coreParticle = Math.random() < 0.18;
    if (coreParticle) radius = Math.pow(Math.random(), 2.7) * 150;
    var angle = arm * Math.PI * 0.5 + radius * 0.014 + (Math.random() - 0.5) * (coreParticle ? 1.2 : 0.32);
    var height = (Math.random() - 0.5) * (coreParticle ? 40 : 86) * (1 - Math.min(radius / 1100, 0.85));
    pos[i * 3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 24;
    pos[i * 3 + 1] = height;
    pos[i * 3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * 24;
    var c = coreParticle || radius < 120
      ? white.clone().lerp(core, Math.random() * 0.78)
      : (radius < 560 ? blue.clone().lerp(white, Math.random() * 0.25) : deep.clone().lerp(blue, Math.random() * 0.45));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  var mat = new THREE.PointsMaterial({
    size: isMobile ? 1.55 : 1.9,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  galaxy.add(new THREE.Points(geo, mat));

  function addGlow(texture, size, opacity) {
    var sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    sprite.scale.set(size, size, 1);
    galaxy.add(sprite);
  }
  addGlow(makeGlowTexture("rgba(255,235,170,1)", "rgba(255,153,68,0.14)"), 440, 0.95);
  addGlow(makeGlowTexture("rgba(160,212,255,0.75)", "rgba(0,80,255,0.1)"), 1350, 0.22);

  var starCount = isMobile ? 1100 : 2600;
  var starGeo = new THREE.BufferGeometry();
  var starPos = new Float32Array(starCount * 3);
  var starCol = new Float32Array(starCount * 3);
  for (var s = 0; s < starCount; s++) {
    starPos[s * 3] = (Math.random() - 0.5) * 4200;
    starPos[s * 3 + 1] = (Math.random() - 0.5) * 2600;
    starPos[s * 3 + 2] = -1400 - Math.random() * 2200;
    starCol[s * 3] = 0.8 + Math.random() * 0.2;
    starCol[s * 3 + 1] = 0.9 + Math.random() * 0.1;
    starCol[s * 3 + 2] = 1;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
    size: 1.4,
    vertexColors: true,
    transparent: true,
    opacity: 0.82,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })));

  galaxy.scale.setScalar(0.24);
  galaxy.rotation.x = 1.04;

  function render() {
    galaxy.rotation.z += 0.00145;
    var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var p = Math.max(0, Math.min(1, window.scrollY / maxScroll));
    galaxy.scale.setScalar(0.24 + p * 1.06);
    camera.position.z = 980 - p * 220;
    target.x += (mouse.x - target.x) * 0.045;
    target.y += (mouse.y - target.y) * 0.045;
    if (!isMobile) {
      galaxy.rotation.y = target.x * 0.18;
      galaxy.rotation.x = 1.04 + target.y * 0.14;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  window.addEventListener("mousemove", function (event) {
    mouse.x = (event.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (event.clientY / window.innerHeight - 0.5) * -2;
  }, { passive: true });

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  render();
})();
