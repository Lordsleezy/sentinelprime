import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

const CYAN = 0x00d4ff;

function build4DVertices() {
  const v = [];
  for (let i = 0; i < 16; i += 1) {
    v.push(
      new THREE.Vector4(
        (i & 1) * 2 - 1,
        ((i >> 1) & 1) * 2 - 1,
        ((i >> 2) & 1) * 2 - 1,
        ((i >> 3) & 1) * 2 - 1
      )
    );
  }
  return v;
}

function v4comp(v, k) {
  if (k === 0) return v.x;
  if (k === 1) return v.y;
  if (k === 2) return v.z;
  return v.w;
}

function buildEdges() {
  const verts = build4DVertices();
  const edges = [];
  for (let i = 0; i < 16; i += 1) {
    for (let j = i + 1; j < 16; j += 1) {
      let d = 0;
      for (let k = 0; k < 4; k += 1) {
        if (Math.abs(v4comp(verts[i], k) - v4comp(verts[j], k)) > 0.01) d += 1;
      }
      if (d === 1) edges.push([i, j]);
    }
  }
  return edges;
}

function rot4Plane(x, y, c, s) {
  const xi = x;
  const yi = y;
  return [xi * c - yi * s, xi * s + yi * c];
}

function rotate4D(v, t) {
  let x = v.x;
  let y = v.y;
  let z = v.z;
  let w = v.w;

  let c = Math.cos(t * 0.62);
  let s = Math.sin(t * 0.62);
  [x, w] = rot4Plane(x, w, c, s);
  c = Math.cos(t * 0.48);
  s = Math.sin(t * 0.48);
  [y, w] = rot4Plane(y, w, c, s);
  c = Math.cos(t * 0.36);
  s = Math.sin(t * 0.36);
  [z, w] = rot4Plane(z, w, c, s);
  c = Math.cos(t * 0.22);
  s = Math.sin(t * 0.22);
  [x, y] = rot4Plane(x, y, c, s);
  c = Math.cos(t * 0.18);
  s = Math.sin(t * 0.18);
  [y, z] = rot4Plane(y, z, c, s);
  c = Math.cos(t * 0.14);
  s = Math.sin(t * 0.14);
  [x, z] = rot4Plane(x, z, c, s);

  return new THREE.Vector4(x, y, z, w);
}

function project4To3(v4, dist) {
  const d = dist - v4.w;
  if (Math.abs(d) < 0.08) {
    return new THREE.Vector3(0, 0, 0);
  }
  const k = 1.15 / d;
  return new THREE.Vector3(v4.x * k, v4.y * k, v4.z * k);
}

function init() {
  const mount = document.getElementById("webgl-root");
  if (!mount) return;

  const edges = buildEdges();
  const baseVerts = build4DVertices();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 6.2);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  mount.appendChild(renderer.domElement);

  const positions = new Float32Array(edges.length * 2 * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.LineBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending
  });
  const lines = new THREE.LineSegments(geo, mat);
  scene.add(lines);

  /* Drifting particles (behind hypercube) */
  const nParticles = 420;
  const pPos = new Float32Array(nParticles * 3);
  const pVel = [];
  for (let i = 0; i < nParticles; i += 1) {
    const rx = (Math.random() - 0.5) * 14;
    const ry = (Math.random() - 0.5) * 14;
    const rz = (Math.random() - 0.5) * 8 - 3;
    pPos[i * 3] = rx;
    pPos[i * 3 + 1] = ry;
    pPos[i * 3 + 2] = rz;
    pVel.push({
      x: (Math.random() - 0.5) * 0.012,
      y: (Math.random() - 0.5) * 0.012,
      z: (Math.random() - 0.5) * 0.004
    });
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.045,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const points = new THREE.Points(pGeo, pMat);
  scene.add(points);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 1.55, 0.5, 0.08);
  composer.addPass(bloomPass);

  let time = 0;
  const projDist = 2.65;

  function tessScaleForViewport(w, h) {
    const m = Math.min(w, h);
    if (w < 640) return m * 0.36;
    return m * 0.44;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  }

  function updateTesseractGeometry() {
    const scale = tessScaleForViewport(window.innerWidth, window.innerHeight);
    let i = 0;
    const t = time;
    for (const [a, b] of edges) {
      const pa = project4To3(rotate4D(baseVerts[a].clone(), t), projDist).multiplyScalar(scale);
      const pb = project4To3(rotate4D(baseVerts[b].clone(), t), projDist).multiplyScalar(scale);
      positions[i++] = pa.x;
      positions[i++] = pa.y;
      positions[i++] = pa.z;
      positions[i++] = pb.x;
      positions[i++] = pb.y;
      positions[i++] = pb.z;
    }
    geo.attributes.position.needsUpdate = true;
  }

  function animateParticles() {
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < nParticles; i += 1) {
      const vx = pVel[i].x;
      const vy = pVel[i].y;
      const vz = pVel[i].z;
      arr[i * 3] += vx;
      arr[i * 3 + 1] += vy;
      arr[i * 3 + 2] += vz;
      if (arr[i * 3] > 8) arr[i * 3] = -8;
      if (arr[i * 3] < -8) arr[i * 3] = 8;
      if (arr[i * 3 + 1] > 8) arr[i * 3 + 1] = -8;
      if (arr[i * 3 + 1] < -8) arr[i * 3 + 1] = 8;
      if (arr[i * 3 + 2] > 2) arr[i * 3 + 2] = -8;
      if (arr[i * 3 + 2] < -10) arr[i * 3 + 2] = 2;
    }
    pGeo.attributes.position.needsUpdate = true;
  }

  function tick() {
    time += 0.0085;
    const pulse = 0.95 + Math.sin(time * 1.15) * 0.22;
    bloomPass.strength = 0.85 * pulse;
    mat.opacity = 0.75 + Math.sin(time * 0.9) * 0.12;

    updateTesseractGeometry();
    animateParticles();
    composer.render();
    requestAnimationFrame(tick);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  tick();
}

init();
