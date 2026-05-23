import * as THREE from "three";

const BASE_ORBIT_SPEED = { desktop: 0.095, mobile: 0.082 };
const WALL_GAP = { desktop: 12, mobile: 10 };
const WALL_PAD = { desktop: 10, mobile: 6 };

/** Dominant orbital angles — hero anchors the composition. */
const AXIS_ORBIT_SLOTS = {
  "+X": { angle: -0.12, ring: "hero" },
  "-X": { angle: Math.PI + 0.1, ring: "hero" },
  "+Y": { angle: -Math.PI * 0.5 + 0.08, ring: "secondary" },
  "-Y": { angle: Math.PI * 0.5 - 0.06, ring: "secondary" },
  "+Z": { angle: Math.PI * 0.24, ring: "developer" },
  "-Z": { angle: -Math.PI * 0.7, ring: "developer" }
};

const TIER_RINGS = {
  hero: {
    speedMul: 0.82,
    desktop: 0.41,
    mobile: { portrait: 0.37, landscape: 0.39 }
  },
  secondary: {
    speedMul: 1,
    desktop: 0.35,
    mobile: { portrait: 0.3, landscape: 0.32 }
  },
  developer: {
    speedMul: 1.14,
    desktop: 0.29,
    mobile: { portrait: 0.24, landscape: 0.26 }
  }
};

const TIER_MIN = {
  desktop: {
    hero: { minW: 204, minH: 78 },
    secondary: { minW: 180, minH: 68 },
    developer: { minW: 148, minH: 52 }
  },
  mobile: {
    hero: { minW: 132, minH: 54 },
    secondary: { minW: 118, minH: 48 },
    developer: { minW: 100, minH: 40 }
  }
};

/**
 * Tiered orbital lanes — shared desktop/mobile with collision-safe drift.
 */
export class GalaxyLabelLayout {
  constructor(opts = {}) {
    this.motionEnabled = opts.motionEnabled !== false;
    this.debug = opts.debug === true;
    this.mobileDebug = opts.mobileDebug === true;
    this._orbitPhase = 0;
    this._tierPhases = { hero: 0, secondary: 0, developer: 0 };
    this._lastTime = performance.now();
    this._slots = [];
    this._initialized = false;
    this.debugOverlay = null;
    this.debugGroup = null;
    this.metrics = { orbitPhase: 0, radius: 0, labelCount: 0, mode: "orbital" };
  }

  _ensureSlots(cells) {
    if (this._initialized) return;
    this._slots.length = 0;
    for (const [axis, cell] of cells) {
      const tierName = cell.product.tier || "secondary";
      cell.layout = { tierName, axis, phase: Math.random() * Math.PI * 2 };
      this._slots.push({ axis, cell });
    }
    this._slots.sort((a, b) => {
      const order = { hero: 0, secondary: 1, developer: 2 };
      return (order[a.cell.layout.tierName] ?? 1) - (order[b.cell.layout.tierName] ?? 1);
    });
    this._initialized = true;
  }

  _measureWall(cell, tierName, mobile) {
    const mins = TIER_MIN[mobile ? "mobile" : "desktop"][tierName] ?? TIER_MIN.desktop.secondary;
    const pad = WALL_PAD[mobile ? "mobile" : "desktop"];
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
    for (let pass = 0; pass < 56; pass += 1) {
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
            const m = ox * 0.5 + 0.75;
            a.cx += sign * m;
            b.cx -= sign * m;
          } else {
            const sign = dy === 0 ? 1 : Math.sign(dy);
            const m = oy * 0.5 + 0.75;
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

  _tickOrbits(mobile, now) {
    const dt = Math.min(0.05, (now - this._lastTime) * 0.001);
    this._lastTime = now;
    if (!this.motionEnabled) return;

    const base = mobile ? BASE_ORBIT_SPEED.mobile : BASE_ORBIT_SPEED.desktop;
    this._orbitPhase += base * dt;
    for (const tier of ["hero", "secondary", "developer"]) {
      this._tierPhases[tier] += base * (TIER_RINGS[tier]?.speedMul ?? 1) * dt;
    }
  }

  _updateOrbital(cells, camera, width, height, mobile, portrait, now) {
    this.metrics.mode = mobile ? "mobile-orbital" : "desktop-orbital";
    this._tickOrbits(mobile, now);

    const cx = width * 0.5;
    const cy = height * 0.5 + (mobile && portrait ? height * 0.015 : 0);
    const bounds = mobile
      ? { left: 10, right: width - 10, top: 32, bottom: height - 24 }
      : { left: 24, right: width - 24, top: 40, bottom: height - 32 };
    const orient = portrait ? "portrait" : "landscape";
    const floatAmp = mobile ? 3.5 : 6;
    const nodes = [];
    let heroRadius = 0;

    for (const { axis, cell } of this._slots) {
      const tierName = cell.layout.tierName;
      const slot = AXIS_ORBIT_SLOTS[axis] ?? { angle: 0, ring: "secondary" };
      const ringCfg = TIER_RINGS[slot.ring] ?? TIER_RINGS.secondary;
      const radiusMul = mobile ? ringCfg.mobile[orient] : ringCfg.desktop;
      const baseR = Math.min(width, height) * radiusMul;
      if (slot.ring === "hero") heroRadius = Math.max(heroRadius, baseR);

      const tierPhase = this._tierPhases[slot.ring] ?? this._orbitPhase;
      const angle = slot.angle + tierPhase;
      const box = this._measureWall(cell, tierName, mobile);
      const t = now * 0.001;
      const floatX = Math.sin(t * 0.85 + cell.layout.phase) * floatAmp;
      const floatY = Math.cos(t * 0.65 + cell.layout.phase * 1.3) * floatAmp * 0.85;

      nodes.push({
        cell,
        layout: cell.layout,
        axis,
        ring: slot.ring,
        cx: cx + Math.cos(angle) * baseR + floatX,
        cy: cy + Math.sin(angle) * baseR + floatY,
        hw: box.hw,
        hh: box.hh,
        w: box.w,
        h: box.h
      });
    }

    const gap = WALL_GAP[mobile ? "mobile" : "desktop"];
    this._separateNodes(nodes, gap);
    this._clampNodes(nodes, bounds);
    this._separateNodes(nodes, gap);

    for (const n of nodes) this._applyToDom(n, camera);

    this.metrics.orbitPhase = this._orbitPhase;
    this.metrics.radius = heroRadius || Math.min(width, height) * 0.35;
    this.metrics.labelCount = nodes.length;

    if (this.debug || this.mobileDebug) {
      this._updateDebugOverlay(nodes, cx, cy, mobile, portrait, bounds);
    }
  }

  update(cells, camera, width, height, isMobile, now = performance.now(), opts = {}) {
    if (width < 1 || height < 1) return;
    this._ensureSlots(cells);
    if (opts.mobileDebug !== undefined) this.mobileDebug = opts.mobileDebug;
    this._updateOrbital(cells, camera, width, height, isMobile, opts.portrait ?? height >= width, now);
  }

  _updateDebugOverlay(nodes, cx, cy, mobile, portrait, bounds) {
    if (!this.debugOverlay) {
      this.debugOverlay = document.createElement("div");
      this.debugOverlay.className = "galaxy-layout-debug";
      this.debugOverlay.setAttribute("aria-hidden", "true");
    }
    if (!this.debugOverlay.parentElement) {
      const mount = document.querySelector(".product-galaxy");
      if (mount) mount.appendChild(this.debugOverlay);
    }

    const orient = portrait ? "portrait" : "landscape";
    let html = "";
    if (bounds) {
      html += `<div class="galaxy-layout-debug__bounds" style="left:${bounds.left}px;top:${bounds.top}px;width:${bounds.right - bounds.left}px;height:${bounds.bottom - bounds.top}px"></div>`;
    }
    for (const ring of ["hero", "secondary", "developer"]) {
      const cfg = TIER_RINGS[ring];
      const r = Math.min(window.innerWidth, window.innerHeight) * (mobile ? cfg.mobile[orient] : cfg.desktop);
      html += `<div class="galaxy-layout-debug__orbit galaxy-layout-debug__orbit--${ring}" style="left:${cx - r}px;top:${cy - r}px;width:${r * 2}px;height:${r * 2}px"></div>`;
    }
    for (const n of nodes) {
      html += `<div class="galaxy-layout-debug__box" style="left:${n.cx - n.hw}px;top:${n.cy - n.hh}px;width:${n.w}px;height:${n.h}px"></div>`;
    }
    html += `<div class="galaxy-layout-debug__hud">${mobile ? "mobile" : "desktop"} orbital · θ=${this._orbitPhase.toFixed(2)}</div>`;
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
