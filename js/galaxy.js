import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Tesseract4D } from "./tesseract4d.js";
import { PRODUCTS, getTierStyle } from "./products-config.js";
import { GalaxyLabelLayout } from "./galaxy-labels.js";
import { VignetteChromaticShader } from "./lib/shaders/vignette-chromatic.js";
import { EdgePulseShader } from "./lib/shaders/edge-pulse.js";

const MOBILE_BREAK = 768;
const DESKTOP_HIGH = 1200;
const CORE_EMISSIVE = 0x00a8cc;
const EDGE_BRIGHT = 0x7ee8ff;
const VERTEX_COLOR = 0xc8f8ff;
const MAX_EDGE_LEN = { mobile: 3.6, medium: 4.2, high: 4.8 };

const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vMid = new THREE.Vector3();
const _vDir = new THREE.Vector3();
const _vUp = new THREE.Vector3(0, 1, 0);
const _vScrA = new THREE.Vector3();
const _vScrB = new THREE.Vector3();

/** Shared edge tube — one GPU buffer for all tesseract instances. */
const SHARED_EDGE_GEO = (() => {
  const geo = new THREE.CylinderGeometry(0.006, 0.006, 1, 6, 1, true);
  geo.translate(0, 0.5, 0);
  return geo;
})();

const SHARED_VERTEX_GEO = new THREE.SphereGeometry(0.048, 8, 8);

const AXIS_EDGE_TINTS = {
  "+X": new THREE.Color(0x00a8cc),
  "-X": new THREE.Color(0x88ddff),
  "+Y": new THREE.Color(0x00c4e8),
  "-Y": new THREE.Color(0xcc4444),
  "+Z": new THREE.Color(0x008899),
  "-Z": new THREE.Color(0x667788)
};

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

function readGalaxyFlags() {
  const params = new URLSearchParams(window.location.search);
  return {
    debug: params.has("galaxyDebug") || params.has("ecosystemDebug"),
    wireframeOnly: params.has("galaxyWireframe"),
    ecosystemDebug: params.has("ecosystemDebug"),
    ecosystemPhysics: !params.has("ecosystemPhysics") || params.get("ecosystemPhysics") !== "0",
    ecosystemClampDebug: params.has("ecosystemClampDebug")
  };
}

class GalaxyPerformanceMonitor {
  constructor() {
    this.frameTimes = [];
    this.fps = 60;
    this.degradeLevel = 0;
    this.lastFrame = performance.now();
    this.lastReport = performance.now();
    this.contextLost = false;
  }

  tick() {
    const now = performance.now();
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 90) this.frameTimes.shift();

    if (now - this.lastReport < 1000) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = avg > 0 ? 1000 / avg : 60;
    this.lastReport = now;

    if (this.fps < 22) this.degradeLevel = Math.min(3, this.degradeLevel + 1);
    else if (this.fps > 52 && this.degradeLevel > 0) this.degradeLevel -= 1;
  }

  shouldHideGhosts() {
    return this.degradeLevel >= 1;
  }

  shouldHideSubtleFaces() {
    return this.degradeLevel >= 2;
  }

  forceWireframeOnly() {
    return this.degradeLevel >= 3;
  }

  bloomMultiplier() {
    return [1, 0.78, 0.58, 0.4][this.degradeLevel];
  }
}

function createSubtleFaceGeometry(faceCount) {
  const positions = new Float32Array(faceCount * 4 * 3);
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(positions, 3);
  attr.usage = THREE.DynamicDrawUsage;
  geo.setAttribute("position", attr);

  const indexArray = [];
  for (let f = 0; f < faceCount; f += 1) {
    const base = f * 4;
    indexArray.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  geo.setIndex(indexArray);
  return { geo, positions };
}

function alignCylinder(mesh, a, b, opts) {
  const {
    camera,
    maxLen,
    quality,
    edgeValid = true,
    viewportW = 0,
    viewportH = 0,
    maxScreenLen = 420,
    stabilityMul = 1
  } = opts;

  if (!edgeValid) {
    mesh.visible = false;
    return { ok: false, len: 0, clamped: true, screenClamped: false };
  }

  _vA.copy(a);
  _vB.copy(b);
  _vMid.addVectors(_vA, _vB).multiplyScalar(0.5);
  _vDir.subVectors(_vB, _vA);
  const len = _vDir.length();
  const fadeStart = maxLen * 0.48;
  const hardMax = maxLen;

  if (len < 0.0001 || len > hardMax || !Number.isFinite(len)) {
    mesh.visible = false;
    return { ok: false, len, clamped: len > hardMax, screenClamped: false };
  }

  let opacityMul = 1;
  if (len > fadeStart) {
    const t = (len - fadeStart) / (hardMax - fadeStart);
    opacityMul = (1 - t) * (1 - t);
  }

  if (camera && viewportW > 0 && viewportH > 0) {
    _vScrA.copy(a).project(camera);
    _vScrB.copy(b).project(camera);
    const sx = (_vScrA.x - _vScrB.x) * viewportW * 0.5;
    const sy = (_vScrA.y - _vScrB.y) * viewportH * 0.5;
    const screenLen = Math.hypot(sx, sy);
    if (screenLen > maxScreenLen) {
      mesh.visible = false;
      return { ok: false, len, clamped: true, screenClamped: true };
    }
    if (screenLen > maxScreenLen * 0.55) {
      const t = (screenLen - maxScreenLen * 0.55) / (maxScreenLen * 0.45);
      opacityMul *= Math.max(0, 1 - t);
    }
  }

  mesh.visible = opacityMul * stabilityMul > 0.03;
  if (!mesh.visible) return { ok: false, len, clamped: opacityMul < 0.99, screenClamped: false };

  mesh.position.copy(_vMid);
  const midDist = camera ? camera.position.distanceTo(_vMid) : 6;
  const thickness = THREE.MathUtils.clamp(1.26 - midDist * 0.04, 0.66, 1.32);
  const qualityMul = quality === "mobile" ? 0.85 : 1;
  mesh.scale.set(thickness * qualityMul, len, thickness * qualityMul);
  mesh.quaternion.setFromUnitVectors(_vUp, _vDir.normalize());

  const u = mesh.material.uniforms;
  if (u?.uOpacity) {
    u.uOpacity.value = mesh.userData.baseOpacity * opacityMul * stabilityMul;
  }

  return { ok: true, len, clamped: opacityMul < 0.99, screenClamped: false };
}

function makeFresnelMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
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
        float f = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.8);
        vec3 col = vec3(0.0, 0.55, 0.72);
        gl_FragColor = vec4(col, f * 0.35);
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
   * @param {boolean} opts.subtleFaces
   * @param {boolean} opts.wireframeOnly
   * @param {HTMLElement} [opts.labelLayer]
   */
  constructor(opts) {
    this.scale = opts.scale ?? 2.5;
    this.opacity = opts.opacity ?? 1;
    this.xwRate = opts.xwRate ?? 0.15;
    this.ywRate = opts.ywRate ?? 0.1;
    this.withCells = opts.withCells ?? true;
    this.quality = opts.quality ?? "high";
    this.wireframeOnly = opts.wireframeOnly ?? false;
    this.isGhost = opts.isGhost === true;
    this.labelLayer = opts.labelLayer ?? null;

    this.tess = new Tesseract4D();
    this.group = new THREE.Group();
    this.edgePulseBoost = 1;
    this.lastClampedEdges = 0;
    this.lastScreenClamped = 0;
    this.stabilityScore = 1;
    this.frameStable = true;
    this.verts = Array.from({ length: 16 }, () => new THREE.Vector3());

    const showSubtleFaces =
      !this.wireframeOnly &&
      opts.subtleFaces !== false &&
      this.quality !== "mobile";

    this.faceMesh = null;
    this.faceMat = null;
    this.facePositions = null;

    if (showSubtleFaces) {
      const { geo, positions } = createSubtleFaceGeometry(this.tess.faces.length);
      this.facePositions = positions;
      this.faceMat = new THREE.MeshBasicMaterial({
        color: 0x006688,
        transparent: true,
        opacity: 0.028 * this.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      this.faceMesh = new THREE.Mesh(geo, this.faceMat);
      this.group.add(this.faceMesh);
    }

    this.edgeMeshes = [];
    this.baseCyan = new THREE.Color(CORE_EMISSIVE);
    this.brightCyan = new THREE.Color(EDGE_BRIGHT);
    this.maxRadiusFactor = this.quality === "mobile" ? 2.18 : this.quality === "medium" ? 2.32 : 2.4;
    this.maxEdgeLen = (MAX_EDGE_LEN[this.quality] ?? MAX_EDGE_LEN.medium) * 0.85;

    /** @type {Map<number, string>} edge index → dominant cell axis for tint */
    this.edgeAxisTint = new Map();
    if (this.withCells) {
      for (const product of PRODUCTS) {
        const indices = this.tess.cells[product.cellAxis];
        const tier = getTierStyle(product.tier);
        for (let e = 0; e < this.tess.edges.length; e += 1) {
          const [a, b] = this.tess.edges[e];
          if (!indices.includes(a) || !indices.includes(b)) continue;
          const prev = this.edgeAxisTint.get(e);
          if (!prev || getTierStyle(PRODUCTS.find((p) => p.cellAxis === prev)?.tier ?? "developer").priority < tier.priority) {
            this.edgeAxisTint.set(e, product.cellAxis);
          }
        }
      }
    }

    for (let i = 0; i < this.tess.edges.length; i += 1) {
      const axis = this.edgeAxisTint.get(i) ?? "+X";
      const tint = AXIS_EDGE_TINTS[axis] ?? this.baseCyan;
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(EdgePulseShader.uniforms),
        vertexShader: EdgePulseShader.vertexShader,
        fragmentShader: EdgePulseShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      mat.uniforms.uBaseColor.value = tint.clone().multiplyScalar(0.55);
      mat.uniforms.uBrightColor.value = tint.clone().lerp(this.brightCyan, 0.45);
      mat.uniforms.uPhase.value = (i / this.tess.edges.length) * 2.3;
      mat.uniforms.uSpeed.value = 0.26 + (i % 5) * 0.05;
      mat.uniforms.uOpacity.value = 0.62 * this.opacity;
      mat.uniforms.uScanStrength.value = this.quality === "high" ? 0.14 : 0.08;
      mat.uniforms.uShimmer.value = this.quality === "high" ? 0.16 : 0.08;
      if (this.quality === "mobile" && i % 2 === 1) {
        mat.uniforms.uOpacity.value *= 0.4;
      }

      const mesh = new THREE.Mesh(SHARED_EDGE_GEO, mat);
      mesh.userData.baseOpacity = mat.uniforms.uOpacity.value;
      this.group.add(mesh);
      this.edgeMeshes.push(mesh);
    }

    this.vertexMeshes = [];
    const vMat = new THREE.MeshBasicMaterial({
      color: VERTEX_COLOR,
      transparent: true,
      opacity: 0.92 * this.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    for (let i = 0; i < 16; i += 1) {
      const m = new THREE.Mesh(SHARED_VERTEX_GEO, vMat.clone());
      this.group.add(m);
      this.vertexMeshes.push(m);
    }

    /** @type {Map<string, { product: typeof PRODUCTS[0], points: THREE.Points, hit: THREE.Mesh, wallEl: HTMLElement, labelEl: HTMLElement, edgeIndices: number[] }>} */
    this.cells = new Map();

    if (this.withCells) {
      for (const product of PRODUCTS) {
        const indices = this.tess.cells[product.cellAxis];
        const tier = getTierStyle(product.tier);
        const pts = new Float32Array(indices.length * 3);
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
        const color = hexToThree(product.color);
        const pMat = new THREE.PointsMaterial({
          color,
          size: tier.pointSize,
          transparent: true,
          opacity: 0.1 * this.opacity * tier.glow,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          sizeAttenuation: true
        });
        const points = new THREE.Points(pGeo, pMat);
        this.group.add(points);

        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(0.85, 8, 8),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hit.userData.product = product;
        this.group.add(hit);

        const wallEl = document.createElement("div");
        wallEl.className = "tess-cell-wall";
        wallEl.style.visibility = "hidden";

        const labelEl = document.createElement("div");
        labelEl.className = "tess-cell-label";
        labelEl.dataset.tier = product.tier;
        labelEl.innerHTML = `<span class="tess-cell-label__name">${product.name}</span><span class="tess-cell-label__tag">${product.tagline}</span><span class="tess-cell-label__enter">ENTER →</span>`;
        wallEl.appendChild(labelEl);
        if (this.labelLayer) this.labelLayer.appendChild(wallEl);

        const edgeIndices = [];
        for (let e = 0; e < this.tess.edges.length; e += 1) {
          const [a, b] = this.tess.edges[e];
          if (indices.includes(a) && indices.includes(b)) edgeIndices.push(e);
        }

        this.cells.set(product.cellAxis, {
          product,
          points,
          hit,
          wallEl,
          labelEl,
          edgeIndices,
          ptPositions: pts,
          labelPx: { x: 0, y: 0 },
          tier,
          physics: null
        });
      }
    }

    this.update(0, null, null);
  }

  /** Canonical frame — pristine 4D → project → validate. Resets group transform. */
  writePositions(time) {
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.set(1, 1, 1);

    const frame = this.tess.computeFrame(
      time,
      this.xwRate,
      this.ywRate,
      this.scale,
      this.maxRadiusFactor,
      this.maxEdgeLen
    );
    this.stabilityScore = frame.stats.stabilityScore;
    this.frameStable = frame.stable;

    const buf = frame.buffer;
    for (let i = 0; i < 16; i += 1) {
      const o = i * 3;
      this.verts[i].set(buf[o], buf[o + 1], buf[o + 2]);
    }

    if (this.faceMesh && this.facePositions) {
      for (let f = 0; f < this.tess.faces.length; f += 1) {
        const face = this.tess.faces[f];
        for (let c = 0; c < 4; c += 1) {
          const v = this.verts[face[c]];
          const o = (f * 4 + c) * 3;
          this.facePositions[o] = v.x;
          this.facePositions[o + 1] = v.y;
          this.facePositions[o + 2] = v.z;
        }
      }
      this.faceMesh.geometry.attributes.position.needsUpdate = true;
    }

    return this.verts;
  }

  applyStabilityAttenuation() {
    const mul = THREE.MathUtils.clamp(this.stabilityScore, 0.12, 1);
    if (this.isGhost) {
      for (const m of this.edgeMeshes) {
        if (m.visible && m.material.uniforms?.uOpacity) {
          m.material.uniforms.uOpacity.value = Math.min(
            m.material.uniforms.uOpacity.value,
            m.userData.baseOpacity * this.opacity * mul
          );
        }
      }
      for (const m of this.vertexMeshes) {
        m.material.opacity = 0.92 * this.opacity * mul;
      }
    }
    return mul;
  }

  update(time, camera, viewport) {
    try {
      const verts = this.writePositions(time);
      let clampedEdges = 0;
      let screenClamped = 0;
      const vw = viewport?.w ?? 0;
      const vh = viewport?.h ?? 0;
      const maxScreenLen = viewport?.maxScreenEdge ?? (vw < MOBILE_BREAK ? 280 : 380);
      const stabMul = THREE.MathUtils.clamp(this.stabilityScore, 0.2, 1);

      for (let e = 0; e < this.tess.edges.length; e += 1) {
        const [a, b] = this.tess.edges[e];
        const result = alignCylinder(this.edgeMeshes[e], verts[a], verts[b], {
          camera,
          maxLen: this.maxEdgeLen,
          quality: this.quality,
          edgeValid: this.tess.edgeValid[e] === 1,
          viewportW: vw,
          viewportH: vh,
          maxScreenLen,
          stabilityMul: stabMul
        });
        if (result.clamped) clampedEdges += 1;
        if (result.screenClamped) screenClamped += 1;
        const u = this.edgeMeshes[e].material.uniforms;
        u.uTime.value = time;
        u.uPulseBoost.value = this.edgePulseBoost;
      }

      this.lastClampedEdges = clampedEdges;
      this.lastScreenClamped = screenClamped;

      const flare = new Array(16).fill(0);
      for (let e = 0; e < this.tess.edges.length; e += 1) {
        const u = this.edgeMeshes[e].material.uniforms;
        const t = (time * u.uSpeed.value + u.uPhase.value) % 1;
        const [a, b] = this.tess.edges[e];
        if (Math.abs(t) < 0.07 || Math.abs(t - 1) < 0.07) flare[a] += 0.55;
        if (Math.abs(t - 0.5) < 0.07) flare[b] += 0.35;
      }

      for (let i = 0; i < 16; i += 1) {
        this.vertexMeshes[i].position.copy(verts[i]);
        const s = 0.75 + flare[i] * 0.45;
        this.vertexMeshes[i].scale.setScalar(s);
        this.vertexMeshes[i].material.opacity = (0.75 + flare[i] * 0.25) * this.opacity;
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

        const center = this.tess.getCellCenterFromBuffer(axis);
        cell.hit.position.set(center.x, center.y, center.z);
      }

      this.applyStabilityAttenuation();
      return verts;
    } catch (err) {
      console.warn("[galaxy] Tesseract update skipped a frame (non-fatal):", err);
      return null;
    }
  }

  setWireframeMode(on) {
    if (this.faceMesh) this.faceMesh.visible = !on;
  }

  setCellOpacity(cellAxis, opacity) {
    const cell = this.cells.get(cellAxis);
    if (!cell) return;
    cell.points.material.opacity = opacity * 0.1 * this.opacity;
    cell.labelEl.style.opacity = String(Math.min(1, opacity * 0.55));
  }

  setCellHighlight(cellAxis, on) {
    const cell = this.cells.get(cellAxis);
    if (!cell) return;
    cell.labelEl.classList.toggle("is-hovered", on);
    const tier = cell.tier ?? getTierStyle(cell.product.tier);
    cell.points.material.opacity = (on ? 0.28 : 0.1) * this.opacity * tier.glow;
    cell.points.material.size = (on ? tier.pointSize + 0.08 : tier.pointSize);
    for (const ei of cell.edgeIndices) {
      this.edgeMeshes[ei].material.uniforms.uPulseBoost.value = on ? 1.6 * tier.edgeBoost : 1;
      this.edgeMeshes[ei].material.uniforms.uSpeed.value = on ? 0.65 : 0.26 + (ei % 5) * 0.05;
      this.edgeMeshes[ei].material.uniforms.uOpacity.value = on
        ? 0.78 * this.opacity * tier.glow
        : this.edgeMeshes[ei].userData.baseOpacity;
    }
  }

  fadeAllExcept(cellAxis, alpha) {
    for (const [axis, cell] of this.cells) {
      if (axis === cellAxis) continue;
      this.setCellOpacity(axis, alpha);
      cell.labelEl.style.opacity = String(alpha * 0.4);
    }
    if (this.faceMat) this.faceMat.opacity = 0.028 * alpha * this.opacity;
    for (const m of this.edgeMeshes) {
      m.material.uniforms.uOpacity.value = 0.62 * alpha * this.opacity;
      if (m.userData.baseOpacity) {
        m.userData.baseOpacity = 0.62 * alpha * this.opacity;
      }
    }
    for (const m of this.vertexMeshes) {
      m.material.opacity = 0.92 * alpha * this.opacity;
    }
  }

  boostCell(cellAxis, boost) {
    const cell = this.cells.get(cellAxis);
    if (!cell) return;
    cell.points.material.opacity = 0.1 * boost * this.opacity;
    cell.points.material.size = 0.18 + boost * 0.12;
    this.edgePulseBoost = boost;
  }
}

/**
 * @param {HTMLElement} root
 */
export function initGalaxy(root) {
  try {
    const mount = root.querySelector(".product-galaxy");
    const canvas = root.querySelector("canvas");
    const hintEls = root.querySelectorAll(".galaxy-hint");
    if (!mount || !canvas) return;

    const flags = readGalaxyFlags();
    const perf = new GalaxyPerformanceMonitor();
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

    let debugEl = null;
    if (flags.debug || flags.ecosystemDebug) {
      debugEl = document.createElement("div");
      debugEl.className = "galaxy-debug-hud";
      mount.appendChild(debugEl);
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020204, quality === "mobile" ? 0.055 : 0.042);
    scene.background = new THREE.Color(0x020204);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 1.15, 7.8);

    const labelLayout = new GalaxyLabelLayout({
      motionEnabled: !reducedMotion,
      debug: flags.ecosystemDebug
    });
    let isDragging = false;
    const focusTarget = new THREE.Vector3();
    const homeTarget = new THREE.Vector3(0, 0, 0);

    const maxDpr = quality === "mobile" ? 1.5 : 2;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality !== "mobile",
      alpha: false,
      powerPreference: "high-performance",
      stencil: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;

    const labelLayer = document.createElement("div");
    labelLayer.className = "galaxy-labels-layer";
    mount.appendChild(labelLayer);

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

    scene.add(new THREE.AmbientLight(0x040608, 0.28));
    const coreLight = new THREE.PointLight(CORE_EMISSIVE, 1.15, 16, 2);
    scene.add(coreLight);

    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    const innerCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0x55aac4,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    coreGroup.add(innerCore);

    const fresnelMat = makeFresnelMaterial();
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(0.48, 20, 20), fresnelMat);
    coreGroup.add(atmosphere);

    const particleCount = quality === "high" ? 180 : quality === "medium" ? 100 : 45;
    const pPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const r = Math.random() * 0.85;
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
        size: 0.035,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    coreGroup.add(coreParticles);

    const godRays = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uIntensity: { value: 0.07 } },
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
            float ray = smoothstep(0.5, 0.0, d) * uIntensity;
            gl_FragColor = vec4(0.0, 0.55, 0.72, ray * (1.0 - d));
          }
        `
      })
    );
    godRays.position.z = -0.5;
    coreGroup.add(godRays);

    const starCount = quality === "high" ? 500 : quality === "medium" ? 320 : 200;
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
        color: 0x8899aa,
        size: quality === "high" ? 0.06 : 0.05,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      })
    );
    scene.add(stars);

    const wireframeOnly = flags.wireframeOnly || quality === "mobile";
    const tessScale = quality === "mobile" ? 2.05 : quality === "medium" ? 2.25 : 2.35;
    const mainTess = new HolographicTesseract({
      scale: tessScale,
      quality,
      withCells: true,
      wireframeOnly,
      labelLayer
    });
    scene.add(mainTess.group);

    if (flags.ecosystemDebug) {
      labelLayout.attachDebugVolume(scene, tessScale * 1.28);
    }

    const ghosts = [];
    if (quality === "high") {
      ghosts.push(
        new HolographicTesseract({
          scale: 1.0,
          opacity: 0.45,
          xwRate: 0.11,
          ywRate: 0.08,
          withCells: false,
          quality,
          subtleFaces: false,
          wireframeOnly: true,
          isGhost: true
        })
      );
      ghosts.push(
        new HolographicTesseract({
          scale: 1.75,
          opacity: 0.35,
          xwRate: 0.13,
          ywRate: 0.09,
          withCells: false,
          quality,
          subtleFaces: false,
          wireframeOnly: true,
          isGhost: true
        })
      );
    } else if (quality === "medium") {
      ghosts.push(
        new HolographicTesseract({
          scale: 1.75,
          opacity: 0.3,
          xwRate: 0.12,
          ywRate: 0.085,
          withCells: false,
          quality,
          subtleFaces: false,
          wireframeOnly: true,
          isGhost: true
        })
      );
    }
    for (const g of ghosts) scene.add(g.group);

    const bloomStrength = quality === "mobile" ? 0.48 : quality === "medium" ? 0.62 : 0.76;
    const bloomRadius = quality === "high" ? 0.4 : quality === "medium" ? 0.34 : 0.28;
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bloomStrength, bloomRadius, 0.35);
    composer.addPass(bloomPass);

    const fxPass = new ShaderPass(VignetteChromaticShader);
    fxPass.uniforms.uStrength.value = 0.48;
    fxPass.uniforms.uGrain.value = quality === "mobile" ? 0 : 0.025;
    composer.addPass(fxPass);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.115;
    controls.enablePan = false;
    controls.minDistance = 4.5;
    controls.maxDistance = 10;
    controls.minPolarAngle = 0.4;
    controls.maxPolarAngle = Math.PI - 0.4;
    controls.target.copy(homeTarget);
    controls.rotateSpeed = 0.26;
    controls.enableRotate = !reducedMotion && !isMobile();
    controls.autoRotate = !reducedMotion;
    controls.autoRotateSpeed = 0.16;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitTargets = [];
    for (const [, cell] of mainTess.cells) hitTargets.push(cell.hit);

    function applyPerformanceDegrade() {
      const hideGhosts = perf.shouldHideGhosts() || perf.contextLost;
      const hideFaces = perf.shouldHideSubtleFaces() || perf.forceWireframeOnly() || wireframeOnly;
      for (const g of ghosts) g.group.visible = !hideGhosts;
      mainTess.setWireframeMode(hideFaces);
      coreParticles.visible = perf.degradeLevel < 2;
      godRays.visible = perf.degradeLevel < 1;
      bloomPass.strength = bloomStrength * perf.bloomMultiplier();
      if (perf.degradeLevel >= 2) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      }
    }

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
      const center = mainTess.tess.getCellCenter(product.cellAxis, tessScale);
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
      isDragging = true;
      controls.autoRotate = false;
      controls.dampingFactor = 0.14;
      mount.classList.add("is-dragging");
    }

    function onControlEnd() {
      lastDragEnd = performance.now();
      isDragging = false;
      controls.dampingFactor = 0.1;
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

    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      perf.contextLost = true;
      stop();
      console.warn("[galaxy] WebGL context lost — rendering paused");
    });

    canvas.addEventListener("webglcontextrestored", () => {
      perf.contextLost = false;
      console.info("[galaxy] WebGL context restored");
      if (!reducedMotion) start();
    });

    function resize() {
      quality = getQualityTier();
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w < 1 || h < 1) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      controls.enableRotate = !reducedMotion && !isMobile();
    }

    function renderFrame(time) {
      perf.tick();
      applyPerformanceDegrade();
      const now = performance.now();

      if (!reducedMotion && !transition) {
        const pulse = 0.5 + 0.5 * Math.sin(time * (Math.PI * 2 / 4));
        const scale = THREE.MathUtils.lerp(1.0, 1.025, pulse);
        innerCore.scale.setScalar(scale);
        coreLight.intensity = 1.05 + pulse * 0.25;
        fresnelMat.uniforms.uTime.value = time;
        coreGroup.rotation.y = time * 0.05;
        coreParticles.rotation.y = -time * 0.035;
        coreParticles.rotation.x = time * 0.02;
        stars.rotation.y = -time * 0.0012;

        if (hoveredCell) {
          const c = mainTess.tess.getCellCenter(hoveredCell.cellAxis, tessScale);
          focusTarget.set(c.x * 0.1, c.y * 0.1, c.z * 0.06);
          controls.target.lerp(focusTarget, 0.05);
        } else if (!isDragging) {
          controls.target.lerp(homeTarget, 0.035);
        }

        mainTess.update(time, camera, {
          w: mount.clientWidth,
          h: mount.clientHeight,
          maxScreenEdge: isMobile() ? 260 : 360
        });
        for (const g of ghosts) {
          if (!g.group.visible) continue;
          g.update(time * (g.xwRate / 0.15), camera, {
            w: mount.clientWidth,
            h: mount.clientHeight,
            maxScreenEdge: isMobile() ? 220 : 300
          });
        }

        labelLayout.update(mainTess.cells, camera, mount.clientWidth, mount.clientHeight, isMobile(), now);

        if (!isMobile() && !isDragging && performance.now() - lastDragEnd > 3500) {
          controls.autoRotate = true;
        }
      } else if (reducedMotion) {
        mainTess.update(0, camera, { w: mount.clientWidth, h: mount.clientHeight });
        labelLayout.update(mainTess.cells, camera, mount.clientWidth, mount.clientHeight, isMobile(), now);
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

        bloomPass.strength = THREE.MathUtils.lerp(bloomStrength, 1.35, e);
        fxPass.uniforms.uRadialBlur.value = e * 0.6;
        fxPass.uniforms.uWhiteFlash.value = Math.max(0, (t - 0.78) / 0.22);

        if (t >= 1) {
          window.location.href = transition.product.pageUrl;
        }
      } else {
        controls.update();
      }

      fxPass.uniforms.uTime.value = time;

      if (debugEl) {
        const info = renderer.info;
        const ts = mainTess.tess.stats;
        const lm = labelLayout.metrics;
        debugEl.textContent =
          `FPS ${perf.fps.toFixed(0)} · stable ${(mainTess.stabilityScore * 100).toFixed(0)}%` +
          ` · vClamp ${ts.clampedVertices} · badE ${ts.invalidEdges}` +
          ` · maxR ${ts.maxRadius.toFixed(2)} · edge ${ts.maxEdgeLength.toFixed(2)}` +
          ` · orbit r=${lm.radius.toFixed(0)} θ=${lm.orbitPhase.toFixed(2)} n=${lm.labelCount}` +
          ` · fade ${mainTess.lastClampedEdges}/${mainTess.lastScreenClamped ?? 0}` +
          (perf.contextLost ? " · CONTEXT LOST" : "");
      }

      try {
        composer.render();
      } catch (err) {
        console.warn("[galaxy] Render frame failed (non-fatal):", err);
        perf.degradeLevel = Math.min(3, perf.degradeLevel + 1);
      }
    }

    function tick() {
      if (!running || disposed || perf.contextLost) return;
      elapsed += 0.016;
      renderFrame(elapsed);
      rafId = requestAnimationFrame(tick);
    }

    function start() {
      if (running || perf.contextLost) return;
      running = true;
      resize();
      if (flags.debug || flags.ecosystemDebug) {
        console.info("[galaxy] ecosystemDebug — labels orbit on a shared circle");
        console.info("[galaxy] ecosystemClampDebug:", flags.ecosystemClampDebug);
      }
      // Optional ambient audio hook (disabled by default):
      // window.GALAXY_AMBIENT_URL = "/assets/ambient.mp3"
      if (window.GALAXY_AMBIENT_URL && !reducedMotion && !window.__galaxyAmbient) {
        window.__galaxyAmbient = new Audio(window.GALAXY_AMBIENT_URL);
        window.__galaxyAmbient.loop = true;
        window.__galaxyAmbient.volume = 0.08;
      }
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
      labelLayer.remove();
      if (debugEl) debugEl.remove();
      if (hintTimer) clearTimeout(hintTimer);
    };
  } catch (err) {
    console.error("[galaxy] initGalaxy failed:", err);
    throw err;
  }
}
