import * as THREE from "three";
import { getTierStyle } from "./products-config.js";

const DESKTOP_ORBIT_SPEED = 0.1;
const DESKTOP_ORBIT_RADIUS = 0.4;

const MOBILE_ORBIT_SPEED = 0.065;
const MOBILE_WALL_GAP = 10;
const MOBILE_WALL_PAD = 6;

/** Fixed angle + tier ring for mobile — hero outer, developer inner. */
const MOBILE_LABEL_SLOTS = {
  "+X": { angle: -0.2, ring: "hero" },
  "-X": { angle: Math.PI + 0.15, ring: "hero" },
  "+Y": { angle: -Math.PI * 0.5, ring: "secondary" },
  "-Y": { angle: Math.PI * 0.5 - 0.1, ring: "secondary" },
  "+Z": { angle: Math.PI * 0.22, ring: "developer" },
  "-Z": { angle: -Math.PI * 0.68, ring: "developer" }
};

const MOBILE_RING_RADIUS = {
  hero: { portrait: 0.36, landscape: 0.38 },
  secondary: { portrait: 0.29, landscape: 0.31 },
  developer: { portrait: 0.23, landscape: 0.25 }
};

const DESKTOP_TIER_MIN = {
  hero: { minW: 204, minH: 78 },
  secondary: { minW: 180, minH: 68 },
  developer: { minW: 148, minH: 52 }
};

const MOBILE_TIER_MIN = {
  hero: { minW: 132, minH: 54 },
  secondary: { minW: 118, minH: 48 },
  developer: { minW: 100, minH: 40 }
};

/**
 * Desktop: single shared orbit. Mobile: tiered rings + collision walls.
 */
export class GalaxyLabelLayout {
  constructor(opts = {}) {
    this.motionEnabled = opts.motionEnabled !== false;
    this.debug = opts.debug === true;
    this.mobileDebug = opts.mobileDebug === true;
    this._orbitPhase = 0;
    this._lastTime = performance.now();
    this._slots = [];
    this._initialized = false;
    this.debugOverlay = null;
    this.debugGroup = null;
    this.metrics = { orbitPhase: 0, radius: 0, labelCount: 0, mode: "desktop" };
  }

  _ensureSlots(cells) {
    if (this._initialized) return;
    this._slots.length = 0;
    for (const [axis, cell] of cells) {
      const tierName = cell.product.tier || "secondary";
      cell.layout = { tierName, axis };
      this._slots.push({ axis, cell });
    }
    this._initialized = true;
  }

  _measureWall(cell, tierName, mobile) {
    const mins = mobile ? (MOBILE_TIER_MIN[tierName] ?? MOBILE_TIER_MIN.secondary) : (DESKTOP_TIER_MIN[tierName] ?? DESKTOP_TIER_MIN.secondary);
    const pad = mobile ? MOBILE_WALL_PAD : 10;
    const label = cell.labelEl;
    const w = Math.max(label.offsetWidth, label.scrollWidth, mins.minW) + pad * 2;
    const h = Math.max(label.offsetHeight, label.scrollHeight, mins.minH) + pad * 2;
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
    wall.classList.toggle("is-debug", this.debug || this.mobileDebug);
    cell.labelEl.style.transform = "none";
  }

  _separateNodes(nodes, gap) {
    for (let pass = 0; pass < 48; pass += 1) {
      let moved = false;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.cx - b.cx;
          const dy = a.cy - b.cy;
          const ox = a.hw + b.hw + gap - Math.abs(dx);
          const oy = a.hh + b.hh + gap - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (ox <= oy) {
            const sign = dx === 0 ? 1 : Math.sign(dx);
            const m = ox * 0.5 + 0.5;
            a.cx += sign * m;
            b.cx -= sign * m;
          } else {
            const sign = dy === 0 ? 1 : Math.sign(dy);
            const m = oy * 0.5 + 0.5;
            a.cy += sign * m;
            b.cy -= sign * m;
          }
        }
      }
      if (!moved) break;
    }
  }

  _clampNodes(nodes, bounds) {
    for (const n of nodes) {
      n.cx = THREE.MathUtils.clamp(n.cx, bounds.left + n.hw, bounds.right - n.hw);
      n.cy = THREE.MathUtils.clamp(n.cy, bounds.top + n.hh, bounds.bottom - n.hh);
    }
  }

  _tickOrbit(speed) {
    const dt = Math.min(0.05, (performance.now() - this._lastTime) * 0.001);
    this._lastTime = performance.now();
    if (this.motionEnabled) this._orbitPhase += speed * dt;
  }

  _updateDesktop(cells, camera, width, height, now) {
    void now;
    this.metrics.mode = "desktop";
    this._tickOrbit(DESKTOP_ORBIT_SPEED);

    const cx = width * 0.5;
    const cy = height * 0.5;
    const radius = Math.min(width, height) * DESKTOP_ORBIT_RADIUS;
    const count = this._slots.length;
    const nodes = [];

    for (let i = 0; i < count; i += 1) {
      const { cell } = this._slots[i];
      const tierName = cell.layout.tierName;
      const box = this._measureWall(cell, tierName, false);
      const angle = this._orbitPhase + (i / count) * Math.PI * 2;
      nodes.push({
        cell,
        layout: cell.layout,
        cx: cx + Math.cos(angle) * radius,
        cy: cy + Math.sin(angle) * radius,
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
    if (this.debug) this._updateDebugOverlay(nodes, cx, cy, radius, width, height, false);
  }

  _updateMobile(cells, camera, width, height, portrait) {
    this.metrics.mode = "mobile";
    this._tickOrbit(MOBILE_ORBIT_SPEED);

    const cx = width * 0.5;
    const cy = height * 0.5 + (portrait ? height * 0.02 : 0);
    const bounds = {
      left: 12,
      right: width - 12,
      top: 36,
      bottom: height - 28
    };
    const orient = portrait ? "portrait" : "landscape";
    const nodes = [];

    for (const { axis, cell } of this._slots) {
      const tierName = cell.layout.tierName;
      const slot = MOBILE_LABEL_SLOTS[axis] ?? { angle: 0, ring: "secondary" };
      const ring = MOBILE_RING_RADIUS[slot.ring] ?? MOBILE_RING_RADIUS.secondary;
      const radiusMul = ring[orient];
      const baseR = Math.min(width, height) * radiusMul;
      const angle = slot.angle + this._orbitPhase;
      const box = this._measureWall(cell, tierName, true);

      nodes.push({
        cell,
        layout: cell.layout,
        axis,
        cx: cx + Math.cos(angle) * baseR,
        cy: cy + Math.sin(angle) * baseR,
        hw: box.hw,
        hh: box.hh,
        w: box.w,
        h: box.h
      });
    }

    this._separateNodes(nodes, MOBILE_WALL_GAP);
    this._clampNodes(nodes, bounds);
    this._separateNodes(nodes, MOBILE_WALL_GAP);

    for (const n of nodes) this._applyToDom(n, camera);

    this.metrics.orbitPhase = this._orbitPhase;
    this.metrics.radius = Math.min(width, height) * MOBILE_RING_RADIUS.hero[orient];
    this.metrics.labelCount = nodes.length;
    if (this.debug || this.mobileDebug) {
      this._updateDebugOverlay(nodes, cx, cy, this.metrics.radius, width, height, true, bounds);
    }
  }

  update(cells, camera, width, height, isMobile, now = performance.now(), opts = {}) {
    if (width < 1 || height < 1) return;
    this._ensureSlots(cells);
    this._lastTime = now;
    if (opts.mobileDebug !== undefined) this.mobileDebug = opts.mobileDebug;

    if (isMobile) {
      this._updateMobile(cells, camera, width, height, opts.portrait ?? height >= width);
    } else {
      this._updateDesktop(cells, camera, width, height, now);
    }
  }

  _updateDebugOverlay(nodes, cx, cy, radius, width, height, mobile, bounds) {
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
    let html = "";
    if (mobile && bounds) {
      html += `<div class="galaxy-layout-debug__bounds" style="left:${bounds.left}px;top:${bounds.top}px;width:${bounds.right - bounds.left}px;height:${bounds.bottom - bounds.top}px"></div>`;
    }
    html += `<div class="galaxy-layout-debug__orbit" style="left:${cx - radius}px;top:${cy - radius}px;width:${d}px;height:${d}px"></div>`;
    for (const n of nodes) {
      html += `<div class="galaxy-layout-debug__box" style="left:${n.cx - n.hw}px;top:${n.cy - n.hh}px;width:${n.w}px;height:${n.h}px"></div>`;
    }
    html += `<div class="galaxy-layout-debug__hud">${mobile ? "mobile" : "desktop"} · r=${radius.toFixed(0)} · θ=${this._orbitPhase.toFixed(2)}</div>`;
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
