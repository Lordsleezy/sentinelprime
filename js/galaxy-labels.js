import * as THREE from "three";
import { getTierStyle } from "./products-config.js";

const _world = new THREE.Vector3();
const _ndc = new THREE.Vector3();

/** World-space anchor bias per cell axis */
export const AXIS_LABEL_OFFSETS = {
  "+X": new THREE.Vector3(1.65, 0.12, 0.3),
  "-X": new THREE.Vector3(-1.65, 0.08, -0.25),
  "+Y": new THREE.Vector3(0.02, 1.35, 0.45),
  "-Y": new THREE.Vector3(-0.02, -1.25, 0.35),
  "+Z": new THREE.Vector3(0.75, 0.28, 1.55),
  "-Z": new THREE.Vector3(-0.55, -0.18, -1.45)
};

/** Hierarchy-aware preferred screen bias (normalized) */
const AXIS_SCREEN_BIAS = {
  "+X": { x: 0.28, y: 0.02 },
  "-X": { x: -0.28, y: 0.02 },
  "+Y": { x: 0.02, y: 0.26 },
  "-Y": { x: 0.16, y: -0.22 },
  "+Z": { x: 0.18, y: 0.08 },
  "-Z": { x: -0.16, y: -0.12 }
};

const TIER_LAYOUT = {
  hero: { biasMul: 1.15, sepBonus: 14, anchorPull: 0.38, moveSmooth: 0.14 },
  secondary: { biasMul: 0.92, sepBonus: 8, anchorPull: 0.26, moveSmooth: 0.12 },
  developer: { biasMul: 0.72, sepBonus: 4, anchorPull: 0.18, moveSmooth: 0.1 }
};

const SOLVER_ITERATIONS = 14;
const FINAL_SEP_PASS = 6;

/**
 * Constraint-based screen-space layout solver — guarantees non-overlapping label boxes.
 */
export class GalaxyLabelLayout {
  constructor(opts = {}) {
    this.physicsEnabled = opts.physicsEnabled !== false;
    this.debug = opts.debug === true;
    this.metrics = {
      overlapsResolved: 0,
      solverIterations: SOLVER_ITERATIONS,
      maxSeparation: 0,
      avgOffset: 0,
      wallClamps: 0
    };
    this._slots = [];
    this._initialized = false;
    this.debugOverlay = null;
    this.debugGroup = null;
  }

  _ensureSlots(cells) {
    if (this._initialized) return;
    this._slots.length = 0;
    for (const [axis, cell] of cells) {
      const tierName = cell.product.tier || "secondary";
      const tier = getTierStyle(tierName);
      const layout = TIER_LAYOUT[tierName] ?? TIER_LAYOUT.secondary;
      const bias = AXIS_SCREEN_BIAS[axis] ?? { x: 0, y: 0 };
      cell.layout = {
        displayX: 0,
        displayY: 0,
        solveX: 0,
        solveY: 0,
        biasX: bias.x * layout.biasMul,
        biasY: bias.y * layout.biasMul,
        weight: tier.priority,
        sepBonus: layout.sepBonus,
        anchorPull: layout.anchorPull,
        moveSmooth: layout.moveSmooth,
        tierName
      };
      this._slots.push({ axis, cell });
    }
    this._slots.sort((a, b) => b.cell.layout.weight - a.cell.layout.weight);
    this._initialized = true;
  }

  /**
   * Iterative AABB separation with hierarchy-weighted displacement.
   * @param {object[]} nodes
   */
  _relaxConstraints(nodes, minSep, cx, cy, minCenter, bounds) {
    let overlaps = 0;
    let maxSep = 0;

    for (let iter = 0; iter < SOLVER_ITERATIONS; iter += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        const pull = a.layout.anchorPull;
        a.x += (a.prefX - a.x) * pull * 0.35;
        a.y += (a.prefY - a.y) * pull * 0.35;

        const acx = a.x - cx;
        const acy = a.y - cy;
        const cd = Math.hypot(acx, acy);
        if (cd < minCenter && cd > 0.001) {
          const push = (minCenter - cd) * 0.55;
          a.x += (acx / cd) * push;
          a.y += (acy / cd) * push;
        }

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const overlapX = (a.hw + b.hw + minSep + a.layout.sepBonus * 0.5 + b.layout.sepBonus * 0.5) - Math.abs(dx);
          const overlapY = (a.hh + b.hh + minSep) - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            overlaps += 1;
            if (overlapX < overlapY) {
              const sign = dx >= 0 ? 1 : -1;
              const totalW = a.weight + b.weight;
              const move = overlapX * 0.5;
              a.x += sign * move * (b.weight / totalW);
              b.x -= sign * move * (a.weight / totalW);
              if (move > maxSep) maxSep = move;
            } else {
              const sign = dy >= 0 ? 1 : -1;
              const totalW = a.weight + b.weight;
              const move = overlapY * 0.5;
              a.y += sign * move * (b.weight / totalW);
              b.y -= sign * move * (a.weight / totalW);
              if (move > maxSep) maxSep = move;
            }
          }
        }
      }
    }

    for (let pass = 0; pass < FINAL_SEP_PASS; pass += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const overlapX = (a.hw + b.hw + minSep) - Math.abs(dx);
          const overlapY = (a.hh + b.hh + minSep) - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              const sign = dx >= 0 ? 1 : -1;
              const move = overlapX * 0.5 + 0.5;
              a.x += sign * move;
              b.x -= sign * move;
            } else {
              const sign = dy >= 0 ? 1 : -1;
              const move = overlapY * 0.5 + 0.5;
              a.y += sign * move;
              b.y -= sign * move;
            }
          }
        }
      }
    }

    let wallClamps = 0;
    for (const n of nodes) {
      const left = bounds.left + n.hw;
      const right = bounds.right - n.hw;
      const top = bounds.top + n.hh;
      const bottom = bounds.bottom - n.hh;
      if (n.x < left) { n.x = left; wallClamps += 1; }
      if (n.x > right) { n.x = right; wallClamps += 1; }
      if (n.y < top) { n.y = top; wallClamps += 1; }
      if (n.y > bottom) { n.y = bottom; wallClamps += 1; }
    }

    this.metrics.overlapsResolved = overlaps;
    this.metrics.maxSeparation = maxSep;
    this.metrics.wallClamps = wallClamps;
  }

  update(cells, camera, width, height, isMobile, now = performance.now()) {
    void now;
    if (width < 1 || height < 1) return;

    this._ensureSlots(cells);

    const marginX = isMobile ? 32 : 40;
    const marginY = isMobile ? 52 : 60;
    const minSep = isMobile ? 12 : 16;
    const minCenter = isMobile ? 118 : 148;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const bounds = {
      left: marginX,
      right: width - marginX,
      top: marginY,
      bottom: height - marginY
    };

    /** @type {object[]} */
    const nodes = [];
    let offsetSum = 0;

    for (const { axis, cell } of this._slots) {
      _world.copy(cell.hit.position);
      const offset = AXIS_LABEL_OFFSETS[axis];
      if (offset) _world.add(offset);

      _ndc.copy(_world).project(camera);
      if (_ndc.z > 1 || _ndc.z < -1) {
        cell.labelEl.style.visibility = "hidden";
        continue;
      }
      cell.labelEl.style.visibility = "visible";
      cell.label.position.copy(_world);

      const layout = cell.layout;
      const tier = cell.tier ?? getTierStyle(cell.product.tier);
      const depthScale = THREE.MathUtils.clamp(1.1 - camera.position.distanceTo(cell.hit.position) * 0.03, 0.72, 1.08) * tier.labelScale;
      const w = (cell.labelEl.offsetWidth || 190) * depthScale;
      const h = (cell.labelEl.offsetHeight || 64) * depthScale;
      const anchorPx = (_ndc.x * 0.5 + 0.5) * width;
      const anchorPy = (-_ndc.y * 0.5 + 0.5) * height;
      const prefX = anchorPx + layout.biasX * width * 0.26;
      const prefY = anchorPy + layout.biasY * height * 0.22;

      const startX = this.physicsEnabled ? anchorPx + cell.layout.displayX : prefX;
      const startY = this.physicsEnabled ? anchorPy + cell.layout.displayY : prefY;

      nodes.push({
        cell,
        axis,
        layout,
        depthScale,
        anchorPx,
        anchorPy,
        prefX,
        prefY,
        x: startX,
        y: startY,
        hw: w * 0.5,
        hh: h * 0.5,
        weight: layout.weight
      });
    }

    if (!this.physicsEnabled) {
      for (const n of nodes) {
        n.cell.labelPx.x = 0;
        n.cell.labelPx.y = 0;
        this._applyTransform(n.cell, n.depthScale);
      }
      return;
    }

    this._relaxConstraints(nodes, minSep, cx, cy, minCenter, bounds);

    for (const n of nodes) {
      const targetOffX = n.x - n.anchorPx;
      const targetOffY = n.y - n.anchorPy;
      const smooth = n.layout.moveSmooth;
      n.layout.displayX += (targetOffX - n.layout.displayX) * smooth;
      n.layout.displayY += (targetOffY - n.layout.displayY) * smooth;
      n.cell.labelPx.x = n.layout.displayX;
      n.cell.labelPx.y = n.layout.displayY;
      offsetSum += Math.hypot(n.layout.displayX, n.layout.displayY);
      n.cell.labelEl.dataset.tier = n.layout.tierName;
      this._applyTransform(n.cell, n.depthScale);
    }

    this.metrics.avgOffset = nodes.length ? offsetSum / nodes.length : 0;

    if (this.debug) this._updateDebugOverlay(nodes, width, height);
  }

  _applyTransform(cell, depthScale) {
    cell.labelEl.style.transform =
      `translate(calc(-50% + ${cell.labelPx.x.toFixed(2)}px), calc(-50% + ${cell.labelPx.y.toFixed(2)}px)) scale(${depthScale.toFixed(3)})`;
  }

  _updateDebugOverlay(nodes, width, height) {
    if (!this.debugOverlay) {
      this.debugOverlay = document.createElement("div");
      this.debugOverlay.className = "galaxy-layout-debug";
      this.debugOverlay.setAttribute("aria-hidden", "true");
    }
    if (!this.debugOverlay.parentElement) {
      const mount = document.querySelector(".product-galaxy");
      if (mount) mount.appendChild(this.debugOverlay);
    }

    let html = "";
    for (const n of nodes) {
      const left = n.x - n.hw;
      const top = n.y - n.hh;
      html += `<div class="galaxy-layout-debug__box" style="left:${left}px;top:${top}px;width:${n.hw * 2}px;height:${n.hh * 2}px"></div>`;
      html += `<div class="galaxy-layout-debug__anchor" style="left:${n.anchorPx}px;top:${n.anchorPy}px"></div>`;
      html += `<div class="galaxy-layout-debug__pref" style="left:${n.prefX}px;top:${n.prefY}px"></div>`;
    }
    html += `<div class="galaxy-layout-debug__bounds" style="left:0;top:0;width:${width}px;height:${height}px"></div>`;
    this.debugOverlay.innerHTML = html;
  }

  attachDebugVolume(scene, radius = 3.2) {
    if (this.debugGroup) return this.debugGroup;
    const geo = new THREE.BoxGeometry(radius * 2, radius * 2, radius * 2);
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.22 })
    );
    this.debugGroup = new THREE.Group();
    this.debugGroup.add(line);
    scene.add(this.debugGroup);
    return this.debugGroup;
  }
}
