import * as THREE from "three";
import { PRODUCTS, CONNECTIONS } from "./products-config.js";

const MOBILE_BREAK = 768;
const CORE_COLOR = 0x00d4ff;

function hexToThree(hex) {
  return parseInt(hex.replace("#", ""), 16);
}

/**
 * @param {HTMLElement} root — .product-galaxy-root
 */
export function initGalaxy(root) {
  const mount = root.querySelector(".product-galaxy");
  const canvas = root.querySelector("canvas");
  const tooltip = root.querySelector(".galaxy-tooltip");
  if (!mount || !canvas || !tooltip) return;

  let disposed = false;
  let running = false;
  let rafId = 0;

  const isMobile = () => window.innerWidth < MOBILE_BREAK;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030305);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 2.8, 7.5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /* Starfield */
  const starCount = 2400;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const r = 12 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.04,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    })
  );
  scene.add(stars);

  /* Sentinel core */
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 32),
    new THREE.MeshStandardMaterial({
      color: CORE_COLOR,
      emissive: CORE_COLOR,
      emissiveIntensity: 1.2,
      metalness: 0.2,
      roughness: 0.35
    })
  );
  const coreGlow = new THREE.PointLight(CORE_COLOR, 1.8, 12);
  coreGlow.position.set(0, 0, 0);
  scene.add(core, coreGlow);
  scene.add(new THREE.AmbientLight(0x111122, 0.35));

  /* Planets */
  const slugToPlanet = new Map();
  const planetMeshes = [];

  for (const product of PRODUCTS) {
    const color = hexToThree(product.color);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 24),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        metalness: 0.15,
        roughness: 0.4
      })
    );
    mesh.userData = { product, baseScale: 1, hovered: false };
    scene.add(mesh);
    slugToPlanet.set(product.slug, mesh);
    planetMeshes.push(mesh);
  }

  /* Constellation lines */
  const linePositions = new Float32Array(CONNECTIONS.length * 2 * 3);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({
      color: CORE_COLOR,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  scene.add(lines);

  function updateOrbits(time) {
    for (const product of PRODUCTS) {
      const mesh = slugToPlanet.get(product.slug);
      const angle = product.orbitPhase + time * product.orbitSpeed;
      const y = Math.sin(angle * 0.7) * 0.18;
      mesh.position.set(
        Math.cos(angle) * product.orbitRadius,
        y,
        Math.sin(angle) * product.orbitRadius
      );
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

  /* Camera orbit */
  let camTheta = 0.35;
  let camPhi = 1.05;
  let targetTheta = camTheta;
  let targetPhi = camPhi;
  const camRadius = 8.2;
  const thetaMin = -0.85;
  const thetaMax = 0.85;
  const phiMin = 0.55;
  const phiMax = 1.35;

  function applyCamera() {
    const x = camRadius * Math.sin(camPhi) * Math.sin(camTheta);
    const y = camRadius * Math.cos(camPhi);
    const z = camRadius * Math.sin(camPhi) * Math.cos(camTheta);
    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  }

  applyCamera();

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let hoveredMesh = null;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function setPointerFromEvent(clientX, clientY) {
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
      hoveredMesh.userData.hovered = false;
      hoveredMesh.scale.setScalar(1);
      hoveredMesh.material.emissiveIntensity = 0.55;
    }
    hoveredMesh = mesh;
    if (mesh) {
      mesh.userData.hovered = true;
      mesh.scale.setScalar(1.1);
      mesh.material.emissiveIntensity = 1.05;
      const { name, tagline } = mesh.userData.product;
      tooltip.querySelector(".galaxy-tooltip__name").textContent = name;
      tooltip.querySelector(".galaxy-tooltip__tag").textContent = tagline;
      tooltip.classList.add("is-visible");
      tooltip.hidden = false;
    } else {
      tooltip.classList.remove("is-visible");
      tooltip.hidden = true;
    }
  }

  function updateTooltipPosition(mesh) {
    if (!mesh) return;
    const v = mesh.position.clone().project(camera);
    const rect = canvas.getBoundingClientRect();
    const x = ((v.x + 1) / 2) * rect.width;
    const y = ((-v.y + 1) / 2) * rect.height;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  function onPointerMove(e) {
    if (isMobile()) return;
    setPointerFromEvent(e.clientX, e.clientY);
    if (dragging) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      targetTheta -= dx * 0.004;
      targetPhi += dy * 0.004;
      targetTheta = THREE.MathUtils.clamp(targetTheta, thetaMin, thetaMax);
      targetPhi = THREE.MathUtils.clamp(targetPhi, phiMin, phiMax);
      return;
    }
    const hit = pickPlanet();
    setHover(hit);
    if (hit) updateTooltipPosition(hit);
  }

  function onPointerDown(e) {
    if (isMobile() || e.button !== 0) return;
    dragging = true;
    mount.classList.add("is-dragging");
    lastX = e.clientX;
    lastY = e.clientY;
    setPointerFromEvent(e.clientX, e.clientY);
  }

  function onPointerUp() {
    dragging = false;
    mount.classList.remove("is-dragging");
  }

  function onClick(e) {
    setPointerFromEvent(e.clientX, e.clientY);
    const hit = pickPlanet();
    if (hit?.userData?.product?.pageUrl) {
      window.location.href = hit.userData.product.pageUrl;
    }
  }

  function onTouchEnd(e) {
    if (!e.changedTouches?.length) return;
    const t = e.changedTouches[0];
    setPointerFromEvent(t.clientX, t.clientY);
    const hit = pickPlanet();
    if (hit?.userData?.product?.pageUrl) {
      window.location.href = hit.userData.product.pageUrl;
    }
  }

  function syncDragClass() {
    mount.classList.toggle("product-galaxy--no-drag", isMobile());
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", () => {
    onPointerUp();
    setHover(null);
  });
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("resize", resize, { passive: true });

  let time = 0;

  function resize() {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w < 1 || h < 1) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    syncDragClass();
  }

  function tick() {
    if (!running || disposed) return;
    time += 0.008;
    const pulse = 1.05 + Math.sin(time * 1.4) * 0.18;
    core.material.emissiveIntensity = pulse;
    core.scale.setScalar(0.98 + Math.sin(time * 1.2) * 0.04);
    coreGlow.intensity = 1.4 + Math.sin(time * 1.4) * 0.35;

    updateOrbits(time);

    if (isMobile()) {
      targetTheta += 0.0018;
      camTheta += (targetTheta - camTheta) * 0.04;
      camPhi += (1.02 - camPhi) * 0.02;
    } else {
      camTheta += (targetTheta - camTheta) * 0.06;
      camPhi += (targetPhi - camPhi) * 0.06;
    }
    applyCamera();

    if (hoveredMesh) updateTooltipPosition(hoveredMesh);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    resize();
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
        else stop();
      }
    },
    { root: null, rootMargin: "80px", threshold: 0.08 }
  );
  observer.observe(root);
  resize();

  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("click", onClick);
    canvas.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("resize", resize);
    renderer.dispose();
    core.geometry.dispose();
    core.material.dispose();
    starGeo.dispose();
    stars.material.dispose();
    lineGeo.dispose();
    lines.material.dispose();
    for (const m of planetMeshes) {
      m.geometry.dispose();
      m.material.dispose();
    }
  };
}
