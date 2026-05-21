import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PRODUCTS, CONNECTIONS } from "./products-config.js";

const MOBILE_BREAK = 768;
const CORE_COLOR = 0xccf8ff;
const CORE_EMISSIVE = 0x00d4ff;

function hexToThree(hex) {
  return parseInt(hex.replace("#", ""), 16);
}

function orbitPosition(product, time) {
  const angle = product.orbitPhase + time * product.orbitSpeed;
  const x = Math.cos(angle) * product.orbitRadius;
  const z = Math.sin(angle) * product.orbitRadius;
  const y = 0;
  const tilt = product.orbitTilt;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  return new THREE.Vector3(x, y * cos - z * sin, y * sin + z * cos);
}

function createStarfield() {
  const count = 1800;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const r = 80 + Math.random() * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const roll = Math.random();
    sizes[i] = roll > 0.92 ? 1.8 : roll > 0.65 ? 1.0 : 0.45;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uParallax: { value: 0 }
    },
    vertexShader: `
      attribute float size;
      attribute float phase;
      uniform float uTime;
      uniform float uParallax;
      varying float vAlpha;
      void main() {
        vec3 pos = position;
        float a = uParallax * 0.35;
        float px = pos.x;
        float pz = pos.z;
        pos.x = px * cos(a) - pz * sin(a);
        pos.z = px * sin(a) + pz * cos(a);
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_PointSize = size * (180.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
        vAlpha = 0.35 + 0.45 * sin(uTime * 0.4 + phase);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float glow = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(0.85, 0.92, 1.0, glow * vAlpha);
      }
    `
  });

  return { points: new THREE.Points(geo, mat), geo, mat };
}

/**
 * @param {HTMLElement} root
 */
export function initGalaxy(root) {
  const mount = root.querySelector(".product-galaxy");
  const canvas = root.querySelector("canvas");
  const hintEls = root.querySelectorAll(".galaxy-hint");
  if (!mount || !canvas) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.innerWidth < MOBILE_BREAK;
  const useBloom = !isMobile() && !reducedMotion;

  let disposed = false;
  let running = false;
  let rafId = 0;
  let elapsed = 0;
  let lastDragEnd = 0;
  let hintFaded = false;
  let hintTimer = 0;
  let prevCamAzimuth = 0;
  let starParallax = 0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.012);

  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 250);
  camera.position.set(0, 6, 26);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "galaxy-labels-layer";
  mount.appendChild(labelRenderer.domElement);

  scene.add(new THREE.AmbientLight(0x0a1420, 0.35));

  const coreLight = new THREE.PointLight(CORE_EMISSIVE, 3.2, 80, 1.4);
  coreLight.position.set(0, 0, 0);
  scene.add(coreLight);

  const coreGroup = new THREE.Group();
  scene.add(coreGroup);

  const coreMat = new THREE.MeshStandardMaterial({
    color: CORE_COLOR,
    emissive: CORE_EMISSIVE,
    emissiveIntensity: 1.4,
    metalness: 0.35,
    roughness: 0.25
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.0, 48, 48), coreMat);
  coreGroup.add(core);

  const coreAtmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.45, 32, 32),
    new THREE.MeshBasicMaterial({
      color: CORE_EMISSIVE,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  coreGroup.add(coreAtmosphere);

  const starfield = createStarfield();
  scene.add(starfield.points);

  const slugToPlanet = new Map();
  /** @type {THREE.Mesh[]} */
  const planetMeshes = [];
  /** @type {{ mesh: THREE.Mesh, labelEl: HTMLElement, ring: THREE.Mesh, product: typeof PRODUCTS[0] }[]} */
  const planets = [];

  for (const product of PRODUCTS) {
    const color = hexToThree(product.color);
    const radius = product.planetRadius ?? 0.7;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 28, 28),
      new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.65,
        metalness: 0.25,
        roughness: 0.35,
        clearcoat: 0.35,
        clearcoatRoughness: 0.4
      })
    );
    mesh.userData = { product, baseEmissive: 0.65 };

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(product.orbitRadius - 0.04, product.orbitRadius + 0.04, 128),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring.rotation.x = Math.PI / 2 + product.orbitTilt;
    scene.add(ring);

    const labelDiv = document.createElement("div");
    labelDiv.className = "galaxy-label";
    labelDiv.innerHTML = `<strong>${product.name}</strong><span>${product.tagline}</span>`;
    const label = new CSS2DObject(labelDiv);
    label.position.set(radius + 0.55, radius * 0.65, 0);
    mesh.add(label);

    scene.add(mesh);
    slugToPlanet.set(product.slug, mesh);
    planetMeshes.push(mesh);
    planets.push({ mesh, labelEl: labelDiv, ring, product });
  }

  const linePositions = new Float32Array(CONNECTIONS.length * 2 * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: CORE_EMISSIVE,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  function updateOrbits(time) {
    for (const { mesh, ring, product } of planets) {
      const pos = orbitPosition(product, time);
      mesh.position.copy(pos);
      ring.rotation.x = Math.PI / 2 + product.orbitTilt;
      mesh.rotation.y = time * 0.35 + product.orbitPhase;
      mesh.rotation.x = Math.sin(time * 0.2 + product.orbitPhase) * 0.08;
    }

    let i = 0;
    for (const [a, b] of CONNECTIONS) {
      const pa = slugToPlanet.get(a).position;
      const pb = slugToPlanet.get(b).position;
      linePositions[i++] = pa.x;
      linePositions[i++] = pa.y;
      linePositions[i++] = pa.z;
      linePositions[i++] = pb.x;
      linePositions[i++] = pb.y;
      linePositions[i++] = pb.z;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 15;
  controls.maxDistance = 45;
  controls.minPolarAngle = Math.PI * 0.22;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.target.set(0, 0, 0);
  controls.enableRotate = !isMobile() && !reducedMotion;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = isMobile() ? 0.35 : 0.28;

  let composer = null;
  if (useBloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.2, 0.6, 0.15);
    composer.addPass(bloom);
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;

  function scheduleHintFade() {
    if (hintTimer) return;
    hintTimer = window.setTimeout(fadeHint, 5000);
  }

  function fadeHint() {
    if (hintFaded) return;
    hintFaded = true;
    hintEls.forEach((el) => el.classList.add("is-faded"));
  }

  function setPointer(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function pickPlanet() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(planetMeshes, false);
    return hits.length ? hits[0].object : null;
  }

  function setHover(mesh) {
    if (hoveredMesh === mesh) return;

    if (hoveredMesh) {
      hoveredMesh.scale.setScalar(1);
      hoveredMesh.material.emissiveIntensity = hoveredMesh.userData.baseEmissive;
      const prev = planets.find((p) => p.mesh === hoveredMesh);
      prev?.labelEl.classList.remove("is-hovered");
    }

    hoveredMesh = mesh;

    if (mesh) {
      mesh.scale.setScalar(1.15);
      mesh.material.emissiveIntensity = 1.35;
      const entry = planets.find((p) => p.mesh === mesh);
      entry?.labelEl.classList.add("is-hovered");
    }
  }

  function onPointerMove(e) {
    if (isMobile()) return;
    setPointer(e.clientX, e.clientY);
    setHover(pickPlanet());
  }

  function onClick(e) {
    setPointer(e.clientX, e.clientY);
    const hit = pickPlanet();
    if (hit?.userData?.product?.pageUrl) {
      window.location.href = hit.userData.product.pageUrl;
    }
  }

  function onTouchEnd(e) {
    if (!e.changedTouches?.length) return;
    const t = e.changedTouches[0];
    setPointer(t.clientX, t.clientY);
    const hit = pickPlanet();
    if (hit?.userData?.product?.pageUrl) {
      window.location.href = hit.userData.product.pageUrl;
    }
  }

  function onControlStart() {
    scheduleHintFade();
    lastDragEnd = performance.now();
    controls.autoRotate = false;
    mount.classList.add("is-dragging");
  }

  function onControlEnd() {
    lastDragEnd = performance.now();
    mount.classList.remove("is-dragging");
  }

  controls.addEventListener("start", onControlStart);
  controls.addEventListener("end", onControlEnd);

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", scheduleHintFade);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("touchstart", scheduleHintFade, { passive: true });
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });

  function syncMobileControls() {
    const mobile = isMobile();
    controls.enableRotate = !mobile && !reducedMotion;
    if (!reducedMotion) {
      controls.autoRotate = mobile || performance.now() - lastDragEnd > 2000;
    }
    mount.classList.toggle("product-galaxy--no-drag", mobile || reducedMotion);
  }

  function resize() {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w < 1 || h < 1) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
    syncMobileControls();
  }

  function renderFrame(time) {
    updateOrbits(time);

    if (!reducedMotion) {
      const pulse = 0.5 + 0.5 * Math.sin(time * (Math.PI * 2 / 3));
      const scale = THREE.MathUtils.lerp(1.0, 1.06, pulse);
      core.scale.setScalar(scale);
      coreMat.emissiveIntensity = 1.2 + pulse * 0.35;
      coreAtmosphere.scale.setScalar(1 + pulse * 0.04);
      coreGroup.rotation.y = time * 0.12;
      coreLight.intensity = 2.8 + pulse * 0.8;

      lineMat.opacity = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(time * 1.8));

      starfield.mat.uniforms.uTime.value = time;

      const azimuth = Math.atan2(camera.position.x, camera.position.z);
      starParallax += (azimuth - prevCamAzimuth) * -0.4;
      prevCamAzimuth = azimuth;
      starfield.mat.uniforms.uParallax.value = starParallax;

      if (!isMobile() && performance.now() - lastDragEnd > 2000) {
        controls.autoRotate = true;
      }
    }

    controls.update();

    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
    labelRenderer.render(scene, camera);
  }

  function tick() {
    if (!running || disposed) return;
    if (!reducedMotion) elapsed += 0.016;
    renderFrame(elapsed);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    resize();
    if (reducedMotion) {
      renderFrame(0);
      return;
    }
    tick();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else if (!reducedMotion) stop();
      }
    },
    { root: null, rootMargin: "80px", threshold: 0.05 }
  );
  observer.observe(root);

  window.addEventListener("resize", resize, { passive: true });
  resize();

  if (reducedMotion) {
    renderFrame(0);
  }

  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    controls.removeEventListener("start", onControlStart);
    controls.removeEventListener("end", onControlEnd);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", scheduleHintFade);
    canvas.removeEventListener("click", onClick);
    canvas.removeEventListener("touchstart", scheduleHintFade);
    canvas.removeEventListener("touchend", onTouchEnd);
    if (hintTimer) clearTimeout(hintTimer);
    window.removeEventListener("resize", resize);
    controls.dispose();
    renderer.dispose();
    labelRenderer.domElement.remove();
    core.geometry.dispose();
    coreMat.dispose();
    coreAtmosphere.geometry.dispose();
    coreAtmosphere.material.dispose();
    starfield.geo.dispose();
    starfield.mat.dispose();
    lineGeo.dispose();
    lineMat.dispose();
    for (const { mesh, ring } of planets) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      ring.geometry.dispose();
      ring.material.dispose();
    }
  };
}
