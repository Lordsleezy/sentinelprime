import * as THREE from "three";
import { getTierStyle } from "./products-config.js";

/** Radians per second — slow, perfectly uniform rotation */
const ORBIT_ANGULAR_SPEED = 0.1;
const ORBIT_RADIUS = { mobile: 0.36, desktop: 0.4 };
const WALL_PAD = 10;

const TIER_MIN = {
  hero: { minW: 204, minH: 78 },
  secondary: { minW: 180, minH: 68 },
  developer: { minW: 148, minH: 52 }
};

/**
 * All labels share one circle — evenly spaced, constant angular velocity.
 */
export class GalaxyLabelLayout {
  constructor(opts = {}) {
    this.motionEnabled = opts.motionEnabled !== false;
    this.debug = opts.debug === true;
    this._orbitPhase = 0;
    this._lastTime = performance.now();
    this._slots = [];
    this._initialized = false;
    this.debugOverlay = null;
    this.debugGroup = null;
    this.metrics = { orbitPhase: 0, radius: 0, labelCount: 0 };
  }

  _ensureSlots(cells) {
    if (this._initialized) return;
    this._slots.length = 0;
    for (const [, cell] of cells) {
      const tierName = cell.product.tier || "secondary";
      cell.layout = { tierName };
      this._slots.push({ cell });
    }
    this._initialized = true;
  }

  _measureWall(cell, tierName) {
    const mins = TIER_MIN[tierName] ?? TIER_MIN.secondary;
    const label = cell.labelEl;
    const w = Math.max(label.offsetWidth, label.scrollWidth, mins.minW) + WALL_PAD * 2;
    const h = Math.max(label.offsetHeight, label.scrollHeight, mins.minH) + WALL_PAD * 2;
    return { w, h, hw: w * 0.5, hh: h * 0.5 };
  }

  _applyToDom(node, camera) {
    const { cell, cx, cy, hw, hh, w, h } = node;
    const wall = cell.wallEl;
    const dist = camera.position.distanceTo(cell.hit.position);

    wall.style.visibility = "visible";
    wall.style.pointerEvents = "auto";
    cell.labelEl.style.visibility = "visible";
    wall.style.width = `${w.toFixed(2)}px`;
    wall.style.height = `${h.toFixed(2)}px`;
    wall.style.left = `${(cx - hw).toFixed(2)}px`;
    wall.style.top = `${(cy - hh).toFixed(2)}px`;
    wall.style.zIndex = String(Math.round(900 - dist * 40));
    wall.dataset.tier = node.layout.tierName;
    wall.classList.toggle("is-debug", this.debug);
    cell.labelEl.style.transform = "none";
  }

  update(cells, camera, width, height, isMobile, now = performance.now()) {
    if (width < 1 || height < 1) return;

    this._ensureSlots(cells);

    const dt = Math.min(0.05, (now - this._lastTime) * 0.001);
    this._lastTime = now;
    if (this.motionEnabled) {
      this._orbitPhase += ORBIT_ANGULAR_SPEED * dt;
    }

    const cx = width * 0.5;
    const cy = height * 0.5;
    const radius = Math.min(width, height) * (isMobile ? ORBIT_RADIUS.mobile : ORBIT_RADIUS.desktop);
    const count = this._slots.length;
    if (count === 0) return;

    /** @type {object[]} */
    const nodes = [];

    for (let i = 0; i < count; i += 1) {
      const { cell } = this._slots[i];
      const tierName = cell.layout.tierName;
      const box = this._measureWall(cell, tierName);
      const angle = this._orbitPhase + (i / count) * Math.PI * 2;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;

      nodes.push({
        cell,
        layout: cell.layout,
        angle,
        cx: px,
        cy: py,
        hw: box.hw,
        hh: box.hh,
        w: box.w,
        h: box.h
      });
    }

    for (const n of nodes) this._applyToDom(n, camera);

    this.metrics.orbitPhase = this._orbitPhase;
    this.metrics.radius = radius;
    this.metrics.labelCount = count;

    if (this.debug) this._updateDebugOverlay(nodes, cx, cy, radius);
  }

  _updateDebugOverlay(nodes, cx, cy, radius) {
    if (!this.debugOverlay) {
      this.debugOverlay = document.createElement("div");
      this.debugOverlay.className = "galaxy-layout-debug";
      this.debugOverlay.setAttribute("aria-hidden", "true");
    }
    if (!this.debugOverlay.parentElement) {
      const mount = document.querySelector(".product-galaxy");
      if (mount) mount.appendChild(this.debugOverlay);
    }

    const d = radius * 2;
    let html = `<div class="galaxy-layout-debug__orbit" style="left:${cx - radius}px;top:${cy - radius}px;width:${d}px;height:${d}px"></div>`;
    for (const n of nodes) {
      html += `<div class="galaxy-layout-debug__box" style="left:${n.cx - n.hw}px;top:${n.cy - n.hh}px;width:${n.w}px;height:${n.h}px"></div>`;
    }
    html += `<div class="galaxy-layout-debug__hud">orbit · r=${radius.toFixed(0)} · θ=${this._orbitPhase.toFixed(2)}</div>`;
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

export const AXIS_LABEL_OFFSETS = {};
