import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { Tesseract4D } from "./tesseract4d.js";
import { PRODUCTS } from "./products-config.js";
import { VignetteChromaticShader } from "./lib/shaders/vignette-chromatic.js";
import { EdgePulseShader } from "./lib/shaders/edge-pulse.js";

const MOBILE_BREAK = 768;
const DESKTOP_HIGH = 1200;
const CORE_EMISSIVE = 0x00d4ff;

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vMid = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _vUp = new THREE.Vector3(0, 1, 0);

function hexToThree(hex) {
  return parseInt(hex.replace("#", ""), 16);
}

function easePower3InOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function getQualityTier() {
  const w = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  if (w < MOBILE_BREAK) return "mobile";
  if (w >= DESKTOP_HIGH && dpr <= 2) return "high";
  return "medium";
}

function alignCylinder(mesh, a, b) {
  _vA.copy(a);
  _vB.copy(b);
  _vMid.addVectors(_vA, _vB).multiplyScalar(0.5);
  _vDir.subVectors(_vB, _vA);
  const len = _vDir.length();
  mesh.position.copy(_vMid);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(_vUp, _vDir.normalize());
}

function makeFresnelMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.4);
        vec3 col = vec3(0.0, 0.85, 1.0);
        gl_FragColor = vec4(col, f * 0.7);
      }
    `
  });
}

class HolographicTesseract {
  /**
   * @param {object} opts
   * @param {number} opts.scale
   * @param {number} opts.opacity
   * @param {number} opts.xwRate
   * @param {number} opts.ywRate
   * @param {boolean} opts.withCells
   * @param {string} opts.quality
   */
  constructor(opts) {
    this.scale = opts.scale ?? 2.5;
    this.opacity = opts.opacity ?? 1;
    this.xwRate = opts.xwRate ?? 0.15;
    this.ywRate = opts.ywRate ?? 0.1;
    this.withCells = opts.withCells ?? true;
    this.quality = opts.quality ?? "high";

    this.tess = new Tesseract4D();
    this.group = new THREE.Group();
    this.edgePulseBoost = 1;

    const faceCount = this.tess.faces.length;
    const facePositions = new Float32Array(faceCount * 4 * 3);
    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setAttribute("position", new THREE.BufferAttribute(facePositions, 3));
    faceGeo.setIndex(
      new Uint16Array(Array.from({ length: faceCount * 6 }, (_, i) => {
        const f = Math.floor(i / 6);
        const v = i % 6;
        const map = [0, 1, 2, 0, 2, 3];
        return f * 4 + map[v];
      }))
    );
    faceGeo.computeVertexNormals();

    this.faceMat = new THREE.MeshPhysicalMaterial({
      color: CORE_EMISSIVE,
      emissive: CORE_EMISSIVE,
      emissiveIntensity: 0.15,
      transmission: 0.9,
      roughness: 0.05,
      thickness: 0.5,
      ior: 1.3,
      transparent: true,
      opacity: 0.08 * this.opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.faceMesh = new THREE.Mesh(faceGeo, this.faceMat);
    this.group.add(this.faceMesh);
    this.facePositions = facePositions;

    this.edgeMeshes = [];
    this.baseCyan = new THREE.Color(CORE_EMISSIVE);
    this.brightCyan = new THREE.Color(0xccfcff);

    for (let i = 0; i < this.tess.edges.length; i += 1) {
      const geo = new THREE.CylinderGeometry(0.015, 0.015, 1, 8, 1, true);
      geo.translate(0, 0.5, 0);
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(EdgePulseShader.uniforms),
        vertexShader: EdgePulseShader.vertexShader,
        fragmentShader: EdgePulseShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      mat.uniforms.uBaseColor.value = this.baseCyan;
      mat.uniforms.uBrightColor.value = this.brightCyan;
      mat.uniforms.uPhase.value = (i / this.tess.edges.length) * 2.3;
      mat.uniforms.uSpeed.value = 0.35 + (i % 5) * 0.08;
      mat.uniforms.uOpacity.value = 0.85 * this.opacity;
      const mesh = new THREE.Mesh(geo, mat);
      this.group.add(mesh);
      this.edgeMeshes.push(mesh);
    }

    this.vertexMeshes = [];
    const vGeo = new THREE.SphereGeometry(0.05, 10, 10);
    const vMat = new THREE.MeshStandardMaterial({
      color: 0xccfcff,
      emissive: CORE_EMISSIVE,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.95 * this.opacity
    });
    for (let i = 0; i < 16; i += 1) {
      const m = new THREE.Mesh(vGeo, vMat.clone());
      this.group.add(m);
      this.vertexMeshes.push(m);
    }

    /** @type {Map<string, { product: typeof PRODUCTS[0], points: THREE.Points, hit: THREE.Mesh, label: CSS2DObject, labelEl: HTMLElement, edgeIndices: number[] }>} */
    this.cells = new Map();

    if (this.withCells) {
      for (const product of PRODUCTS) {
        const indices = this.tess.cells[product.cellAxis];
        const pts = new Float32Array(indices.length * 3);
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        const color = hexToThree(product.color);
        const pMat = new THREE.PointsMaterial({
          color,
          size: 0.22,
          transparent: true,
          opacity: 0.12 * this.opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true
        });
        const points = new THREE.Points(pGeo, pMat);
        this.group.add(points);

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.85, 12, 12),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.userData.product = product;
        this.group.add(hit);

        const labelEl = document.createElement("div");
        labelEl.className = "tess-cell-label";
        labelEl.innerHTML = `<span class="tess-cell-label__name">${product.name}</span><span class="tess-cell-label__tag">${product.tagline}</span><span class="tess-cell-label__enter">ENTER →</span>`;
        const label = new CSS2DObject(labelEl);
        this.group.add(label);

        const edgeIndices = [];
        for (let e = 0; e < this.tess.edges.length; e += 1) {
          const [a, b] = this.tess.edges[e];
          if (indices.includes(a) && indices.includes(b)) edgeIndices.push(e);
        }

        this.cells.set(product.cellAxis, {
          product,
          points,
          hit,
          label,
          labelEl,
          edgeIndices,
          ptPositions: pts
        });
      }
    }
  }

  update(time, projectedOverride) {
    if (!projectedOverride) {
      this.tess.rotate(time, this.xwRate, this.ywRate);
    }
    const projected = projectedOverride ?? this.tess.getProjectedVertices(this.scale);
    const verts = projected.map((p) => new THREE.Vector3(p.x, p.y, p.z));

    for (let f = 0; f < this.tess.faces.length; f += 1) {
      const face = this.tess.faces[f];
      for (let c = 0; c < 4; c += 1) {
        const v = verts[face[c]];
        const o = (f * 4 + c) * 3;
        this.facePositions[o] = v.x;
        this.facePositions[o + 1] = v.y;
        this.facePositions[o + 2] = v.z;
      }
    }
    this.faceMesh.geometry.attributes.position.needsUpdate = true;
    this.faceMesh.geometry.computeVertexNormals();

    for (let e = 0; e < this.tess.edges.length; e += 1) {
      const [a, b] = this.tess.edges[e];
      alignCylinder(this.edgeMeshes[e], verts[a], verts[b]);
      this.edgeMeshes[e].material.uniforms.uTime.value = time;
      this.edgeMeshes[e].material.uniforms.uPulseBoost.value = this.edgePulseBoost;
    }

    const flare = {};
    for (let e = 0; e < this.tess.edges.length; e += 1) {
      const t = (time * this.edgeMeshes[e].material.uniforms.uSpeed.value +
        this.edgeMeshes[e].material.uniforms.uPhase.value) % 1;
      const [a, b] = this.tess.edges[e];
      const nearA = Math.abs(t - 0) < 0.08 || Math.abs(t - 1) < 0.08;
      const nearB = Math.abs(t - 0.5) < 0.08;
      if (nearA) flare[a] = (flare[a] ?? 1) + 0.6;
      if (nearB) flare[b] = (flare[b] ?? 1) + 0.4;
    }

    for (let i = 0; i < 16; i += 1) {
      this.vertexMeshes[i].position.copy(verts[i]);
      const s = 0.85 + (flare[i] ?? 0) * 0.35;
      this.vertexMeshes[i].scale.setScalar(s);
      this.vertexMeshes[i].material.emissiveIntensity = 1.8 + (flare[i] ?? 0) * 1.2;
    }

    if (!this.withCells) return verts;

    for (const [axis, cell] of this.cells) {
      const indices = this.tess.cells[axis];
      for (let i = 0; i < indices.length; i += 1) {
        const v = verts[indices[i]];
        cell.ptPositions[i * 3] = v.x;
        cell.ptPositions[i * 3 + 1] = v.y;
        cell.ptPositions[i * 3 + 2] = v.z;
      }
      cell.points.geometry.attributes.position.needsUpdate = true;

      const center = this.tess.getCellCenter(axis, this.scale);
      cell.hit.position.set(center.x, center.y, center.z);
      cell.label.position.set(center.x, center.y + 0.35, center.z);
    }

    return verts;
  }

  setCellOpacity(cellAxis, opacity) {
    const cell = this.cells.get(cellAxis);
    if (!cell) return;
    cell.points.material.opacity = opacity * 0.12 * this.opacity;
    cell.labelEl.style.opacity = String(Math.min(1, opacity * 0.55));
  }

  setCellHighlight(cellAxis, on) {
    const cell = this.cells.get(cellAxis);
    if (!cell) return;
    cell.labelEl.classList.toggle("is-hovered", on);
    cell.points.material.opacity = (on ? 0.35 : 0.12) * this.opacity;
    cell.points.material.size = on ? 0.32 : 0.22;
    for (const ei of cell.edgeIndices) {
      this.edgeMeshes[ei].material.uniforms.uPulseBoost.value = on ? 2.2 : 1;
      this.edgeMeshes[ei].material.uniforms.uSpeed.value = on ? 0.85 : 0.35 + (ei % 5) * 0.08;
    }
  }

  fadeAllExcept(cellAxis, alpha) {
    for (const [axis, cell] of this.cells) {
      if (axis === cellAxis) continue;
      this.setCellOpacity(axis, alpha);
      cell.labelEl.style.opacity = String(alpha * 0.4);
    }
    this.faceMat.opacity = 0.08 * alpha * this.opacity;
    for (const m of this.edgeMeshes) {
      m.material.uniforms.uOpacity.value = 0.85 * alpha * this.opacity;
    }
    for (const m of this.vertexMeshes) {
      m.material.opacity = 0.95 * alpha * this.opacity;
    }
  }

  boostCell(cellAxis, boost) {
    const cell = this.cells.get(cellAxis);
    if (!cell) return;
    cell.points.material.opacity = 0.12 * boost * this.opacity;
    cell.points.material.size = 0.22 + boost * 0.15;
    this.edgePulseBoost = boost;
  }
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
  let quality = getQualityTier();
  const isMobile = () => window.innerWidth < MOBILE_BREAK;

  let disposed = false;
  let running = false;
  let rafId = 0;
  let elapsed = 0;
  let lastDragEnd = 0;
  let hintTimer = 0;
  let hoveredCell = null;
  /** @type {{ product: typeof PRODUCTS[0], start: number, duration: number, fromPos: THREE.Vector3, toPos: THREE.Vector3, fromFov: number } | null} */
  let transition = null;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 1.5, 7);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: quality !== "mobile",
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.className = "galaxy-labels-layer";
  mount.appendChild(labelRenderer.domElement);

  if (reducedMotion) {
    const msg = document.createElement("p");
    msg.className = "galaxy-reduced-msg";
    msg.textContent = "Animations reduced — click a cell label to navigate.";
    mount.appendChild(msg);
    for (const product of PRODUCTS) {
      const link = document.createElement("a");
      link.href = product.pageUrl;
      link.className = "galaxy-reduced-link";
      link.textContent = product.name;
      msg.appendChild(document.createElement("br"));
      msg.appendChild(link);
    }
  }

  scene.add(new THREE.AmbientLight(0x060a12, 0.4));
  const coreLight = new THREE.PointLight(CORE_EMISSIVE, 2.5, 20, 1.6);
  scene.add(coreLight);

  const coreGroup = new THREE.Group();
  scene.add(coreGroup);

  const innerCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 32, 32),
    new THREE.MeshStandardMaterial({
      color: 0xccfcff,
      emissive: CORE_EMISSIVE,
      emissiveIntensity: 2.2,
      metalness: 0.2,
      roughness: 0.2
    })
  );
  coreGroup.add(innerCore);

  const fresnelMat = makeFresnelMaterial();
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), fresnelMat);
  coreGroup.add(atmosphere);

  const particleCount = quality === "high" ? 300 : quality === "medium" ? 150 : 75;
  const pPos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    const r = Math.random() * 1.0;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    pPos[i * 3] = r * Math.sin(p) * Math.cos(t);
    pPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
    pPos[i * 3 + 2] = r * Math.cos(p);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const coreParticles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      color: CORE_EMISSIVE,
      size: 0.04,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  coreGroup.add(coreParticles);

  const godRays = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uIntensity: { value: 0.35 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          vec2 c = vUv - 0.5;
          float d = length(c);
          float ray = smoothstep(0.55, 0.0, d) * uIntensity;
          gl_FragColor = vec4(0.0, 0.85, 1.0, ray * (1.0 - d));
        }
      `
    })
  );
  godRays.position.z = -0.5;
  coreGroup.add(godRays);

  const starCount = quality === "high" ? 800 : quality === "medium" ? 500 : 350;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const r = 30 + Math.random() * 50;
    const t = Math.random() * Math.PI * 2;
    const p = Math.acos(2 * Math.random() - 1);
    starPos[i * 3] = r * Math.sin(p) * Math.cos(t);
    starPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
    starPos[i * 3 + 2] = r * Math.cos(p);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xaaccff,
      size: quality === "high" ? 0.08 : 0.06,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    })
  );
  scene.add(stars);

  const mainTess = new HolographicTesseract({ scale: 2.5, quality, withCells: true });
  scene.add(mainTess.group);

  const ghosts = [];
  if (quality === "high") {
    ghosts.push(new HolographicTesseract({ scale: 1.0, opacity: 0.03, xwRate: 0.11, ywRate: 0.08, withCells: false, quality }));
    ghosts.push(new HolographicTesseract({ scale: 1.75, opacity: 0.03, xwRate: 0.13, ywRate: 0.09, withCells: false, quality }));
  } else if (quality === "medium") {
    ghosts.push(new HolographicTesseract({ scale: 1.75, opacity: 0.03, xwRate: 0.12, ywRate: 0.085, withCells: false, quality }));
  }
  for (const g of ghosts) scene.add(g.group);

  const bloomStrength = quality === "mobile" ? 1.2 : 1.6;
  const bloomRadius = quality === "high" ? 0.8 : quality === "medium" ? 0.65 : 0.55;
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bloomStrength, bloomRadius, 0.1);
  composer.addPass(bloomPass);

  const fxPass = new ShaderPass(VignetteChromaticShader);
  fxPass.uniforms.uStrength.value = 0.4;
  fxPass.uniforms.uGrain.value = quality === "mobile" ? 0 : 0.035;
  composer.addPass(fxPass);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 12;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI - 0.3;
  controls.target.set(0, 0, 0);
  controls.enableRotate = !reducedMotion && !isMobile();
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.3;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hitTargets = [];
  for (const [, cell] of mainTess.cells) hitTargets.push(cell.hit);

  function scheduleHintFade() {
    if (hintTimer) return;
    hintTimer = window.setTimeout(() => {
      hintEls.forEach((el) => el.classList.add("is-faded"));
    }, 5000);
  }

  function setPointer(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
  }

  function pickCell() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(hitTargets, false);
    return hits.length ? hits[0].object.userData.product : null;
  }

  function setHover(product) {
    if (hoveredCell?.cellAxis === product?.cellAxis) return;
    if (hoveredCell) mainTess.setCellHighlight(hoveredCell.cellAxis, false);
    hoveredCell = product ? PRODUCTS.find((p) => p.slug === product.slug) : null;
    if (hoveredCell) mainTess.setCellHighlight(hoveredCell.cellAxis, true);
  }

  function startTransition(product) {
    if (transition) return;
    transition = {
      product,
      start: performance.now(),
      duration: 1400,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(),
      fromFov: camera.fov
    };
    const center = mainTess.tess.getCellCenter(product.cellAxis, 2.5);
    transition.toPos.set(center.x, center.y, center.z);
    transition.toPos.multiplyScalar(0.35);
    transition.toPos.z += 1.2;
    controls.enabled = false;
    scheduleHintFade();
  }

  function onPointerMove(e) {
    if (transition || reducedMotion || isMobile()) return;
    setPointer(e.clientX, e.clientY);
    setHover(pickCell());
  }

  function onClick(e) {
    if (transition) return;
    if (reducedMotion) return;
    setPointer(e.clientX, e.clientY);
    const product = pickCell();
    if (product) startTransition(product);
  }

  function onLabelClick(e) {
    const axis = e.currentTarget.dataset.cellAxis;
    const product = PRODUCTS.find((p) => p.cellAxis === axis);
    if (product && !transition) startTransition(product);
  }

  for (const [, cell] of mainTess.cells) {
    cell.labelEl.dataset.cellAxis = cell.product.cellAxis;
    cell.labelEl.addEventListener("click", onLabelClick);
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
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (transition || !e.changedTouches?.length) return;
      const t = e.changedTouches[0];
      setPointer(t.clientX, t.clientY);
      const product = pickCell();
      if (product) startTransition(product);
    },
    { passive: true }
  );

  function resize() {
    quality = getQualityTier();
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (w < 1 || h < 1) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    composer.setSize(w, h);
    controls.enableRotate = !reducedMotion && !isMobile();
  }

  function renderFrame(time) {
    if (!reducedMotion && !transition) {
      const pulse = 0.5 + 0.5 * Math.sin(time * (Math.PI * 2 / 4));
      const scale = THREE.MathUtils.lerp(1.0, 1.04, pulse);
      innerCore.scale.setScalar(scale);
      innerCore.material.emissiveIntensity = 2.0 + pulse * 0.5;
      coreLight.intensity = 2.2 + pulse * 0.6;
      fresnelMat.uniforms.uTime.value = time;
      coreGroup.rotation.y = time * 0.08;
      coreParticles.rotation.y = -time * 0.05;
      coreParticles.rotation.x = time * 0.03;
      stars.rotation.y = -time * 0.002;

      mainTess.update(time);
      for (const g of ghosts) g.update(time * (g.xwRate / 0.15));

      if (!isMobile() && performance.now() - lastDragEnd > 3000) {
        controls.autoRotate = true;
      }
    } else if (reducedMotion) {
      mainTess.tess.rotate(0, 0, 0);
      mainTess.update(0);
    }

    if (transition) {
      const t = Math.min(1, (performance.now() - transition.start) / transition.duration);
      const e = easePower3InOut(t);
      camera.position.lerpVectors(transition.fromPos, transition.toPos, e + Math.sin(e * Math.PI) * 0.08);
      camera.fov = THREE.MathUtils.lerp(transition.fromFov, 80, e);
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);

      mainTess.fadeAllExcept(transition.product.cellAxis, Math.max(0, 1 - t / 0.7));
      mainTess.boostCell(transition.product.cellAxis, 1 + e * 2.5);
      mainTess.setCellHighlight(transition.product.cellAxis, true);

      bloomPass.strength = THREE.MathUtils.lerp(bloomStrength, 3.0, e);
      fxPass.uniforms.uRadialBlur.value = e;
      fxPass.uniforms.uWhiteFlash.value = Math.max(0, (t - 0.72) / 0.28);

      if (t >= 1) {
        window.location.href = transition.product.pageUrl;
      }
    } else {
      controls.update();
    }

    composer.render();
    labelRenderer.render(scene, camera);
  }

  function tick() {
    if (!running || disposed) return;
    elapsed += 0.016;
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
    { rootMargin: "80px", threshold: 0.05 }
  );
  observer.observe(root);
  window.addEventListener("resize", resize, { passive: true });
  resize();
  if (reducedMotion) renderFrame(0);

  return () => {
    disposed = true;
    stop();
    observer.disconnect();
    controls.dispose();
    renderer.dispose();
    labelRenderer.domElement.remove();
    if (hintTimer) clearTimeout(hintTimer);
  };
}
