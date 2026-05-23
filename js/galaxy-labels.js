import * as THREE from "three";
import { getTierStyle } from "./products-config.js";

const _world = new THREE.Vector3();
const _ndc = new THREE.Vector3();

/** Fixed orbital slots — labels start here so they never cluster at the tesseract center. */
const AXIS_WALL_SLOTS = {
  "+X": { nx: 0.82, ny: 0.04 },
  "-X": { nx: -0.82, ny: -0.04 },
  "+Y": { nx: 0.04, ny: -0.72 },
  "-Y": { nx: -0.04, ny: 0.72 },
  "+Z": { nx: 0.62, ny: 0.5 },
  "-Z": { nx: -0.58, ny: -0.48 }
};

const TIER_LAYOUT = {
  hero: { sepBonus: 24, slotScale: 1.06, minW: 204, minH: 78 },
  secondary: { sepBonus: 16, slotScale: 1, minW: 180, minH: 68 },
  developer: { sepBonus: 12, slotScale: 0.94, minW: 152, minH: 54 }
};

const WALL_GAP = 14;
const WALL_PAD = 12;
const MAX_WALL_PASSES = 96;

/**
 * Hard collision walls — each label lives inside an explicit non-overlapping shell.
 */
export class GalaxyLabelLayout {
  constructor(opts = {}) {
    this.physicsEnabled = opts.physicsEnabled !== false;
    this.debug = opts.debug === true;
    this.metrics = {
      overlapsResolved: 0,
      remainingOverlaps: 0,
      domOverlaps: 0,
      solverPasses: 0,
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
      cell.layout = {
        cx: 0,
        cy: 0,
        placed: false,
        weight: tier.priority,
        sepBonus: layout.sepBonus,
        slotScale: layout.slotScale,
        minW: layout.minW,
        minH: layout.minH,
        tierName
      };
      this._slots.push({ axis, cell });
    }
    this._slots.sort((a, b) => b.cell.layout.weight - a.cell.layout.weight);
    this._initialized = true;
  }

  _slotCenter(axis, cx, cy, width, height, hw, hh, bounds, slotScale) {
    const slot = AXIS_WALL_SLOTS[axis] ?? { nx: 0, ny: 0 };
    const radius = Math.min(width, height) * 0.44 * slotScale;
    let x = cx + slot.nx * radius;
    let y = cy + slot.ny * radius;
    x = THREE.MathUtils.clamp(x, bounds.left + hw, bounds.right - hw);
    y = THREE.MathUtils.clamp(y, bounds.top + hh, bounds.bottom - hh);
    return { x, y };
  }

  _gapForPair(a, b) {
    return WALL_GAP + (a.layout.sepBonus + b.layout.sepBonus) * 0.35;
  }

  _separatePair(a, b) {
    const gap = this._gapForPair(a, b);
    const dx = a.cx - b.cx;
    const dy = a.cy - b.cy;
    const overlapX = a.hw + b.hw + gap - Math.abs(dx);
    const overlapY = a.hh + b.hh + gap - Math.abs(dy);
    if (overlapX <= 0 || overlapY <= 0) return 0;

    const totalW = Math.max(1, a.weight + b.weight);
    let moved = 0;

    if (overlapX <= overlapY) {
      const sign = dx === 0 ? (a.weight >= b.weight ? 1 : -1) : Math.sign(dx);
      const move = overlapX + 1.5;
      a.cx += sign * move * (b.weight / totalW);
      b.cx -= sign * move * (a.weight / totalW);
      moved = move;
    } else {
      const sign = dy === 0 ? (a.weight >= b.weight ? 1 : -1) : Math.sign(dy);
      const move = overlapY + 1.5;
      a.cy += sign * move * (b.weight / totalW);
      b.cy -= sign * move * (a.weight / totalW);
      moved = move;
    }
    return moved;
  }

  _countOverlaps(nodes) {
    let count = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const gap = this._gapForPair(a, b);
        if (Math.abs(a.cx - b.cx) < a.hw + b.hw + gap && Math.abs(a.cy - b.cy) < a.hh + b.hh + gap) {
          count += 1;
        }
      }
    }
    return count;
  }

  _resolveWallCollisions(nodes) {
    let passes = 0;
    let resolved = 0;

    for (let pass = 0; pass < MAX_WALL_PASSES; pass += 1) {
      let moved = false;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const sep = this._separatePair(nodes[i], nodes[j]);
          if (sep > 0) {
            moved = true;
            resolved += 1;
          }
        }
      }
      passes += 1;
      if (!moved) break;
    }

    this.metrics.overlapsResolved = resolved;
    this.metrics.solverPasses = passes;
    this.metrics.remainingOverlaps = this._countOverlaps(nodes);
  }

  _clampWalls(nodes, bounds) {
    let clamps = 0;
    for (const n of nodes) {
      const minX = bounds.left + n.hw;
      const maxX = bounds.right - n.hw;
      const minY = bounds.top + n.hh;
      const maxY = bounds.bottom - n.hh;
      if (n.cx < minX) { n.cx = minX; clamps += 1; }
      if (n.cx > maxX) { n.cx = maxX; clamps += 1; }
      if (n.cy < minY) { n.cy = minY; clamps += 1; }
      if (n.cy > maxY) { n.cy = maxY; clamps += 1; }
    }
    this.metrics.wallClamps = clamps;
  }

  _measureWall(cell, layout, depthScale) {
    const label = cell.labelEl;
    const domW = Math.max(label.offsetWidth, label.scrollWidth, layout.minW);
    const domH = Math.max(label.offsetHeight, label.scrollHeight, layout.minH);
    const w = domW * depthScale + WALL_PAD * 2;
    const h = domH * depthScale + WALL_PAD * 2;
    return { w, h, hw: w * 0.5, hh: h * 0.5 };
  }

  _applyWallToDom(node, camera) {
    const { cell, cx, cy, w, h, hw, hh, depthScale } = node;
    const wall = cell.wallEl;
    const dist = camera.position.distanceTo(cell.hit.position);

    wall.style.width = `${w.toFixed(2)}px`;
    wall.style.height = `${h.toFixed(2)}px`;
    wall.style.left = `${(cx - hw).toFixed(2)}px`;
    wall.style.top = `${(cy - hh).toFixed(2)}px`;
    wall.style.zIndex = String(Math.round(900 - dist * 40));
    wall.dataset.tier = node.layout.tierName;
    wall.classList.toggle("is-debug", this.debug);

    cell.labelEl.style.transform = "none";
    cell.layout.cx = cx;
    cell.layout.cy = cy;
    cell.layout.placed = true;
  }

  _readDomWalls(nodes, layerEl) {
    const layerRect = layerEl.getBoundingClientRect();
    for (const n of nodes) {
      const r = n.cell.labelEl.getBoundingClientRect();
      const pad = WALL_GAP * 0.5;
      n.cx = r.left - layerRect.left + r.width * 0.5;
      n.cy = r.top - layerRect.top + r.height * 0.5;
      n.hw = r.width * 0.5 + pad;
      n.hh = r.height * 0.5 + pad;
      n.w = r.width + pad * 2;
      n.h = r.height + pad * 2;
    }
  }

  _domRectsOverlap(a, b, gap = WALL_GAP) {
    return !(
      a.cx + a.hw + gap <= b.cx - b.hw ||
      b.cx + b.hw + gap <= a.cx - a.hw ||
      a.cy + a.hh + gap <= b.cy - b.hh ||
      b.cy + b.hh + gap <= a.cy - a.hh
    );
  }

  _enforceDomWalls(nodes, layerEl) {
    if (!layerEl) return;

    this._readDomWalls(nodes, layerEl);

    let domOverlaps = 0;
    for (let pass = 0; pass < 32; pass += 1) {
      let moved = false;
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          if (!this._domRectsOverlap(a, b, WALL_GAP)) continue;
          moved = true;
          domOverlaps += 1;
          this._separatePair(a, b);
        }
      }
      if (!moved) break;
    }

    this.metrics.domOverlaps = domOverlaps;
    this.metrics.remainingOverlaps = this._countOverlaps(nodes);
  }

  _applyAllWalls(nodes, camera) {
    for (const n of nodes) this._applyWallToDom(n, camera);
  }

  _nudgeTowardAnchor(node, anchorPx, anchorPy, maxPull = 18) {
    const dx = anchorPx - node.cx;
    const dy = anchorPy - node.cy;
    const d = Math.hypot(dx, dy);
    if (d < 0.001 || d <= maxPull) {
      node.cx += dx * 0.08;
      node.cy += dy * 0.08;
      return;
    }
    node.cx += (dx / d) * maxPull * 0.08;
    node.cy += (dy / d) * maxPull * 0.08;
  }

  update(cells, camera, width, height, isMobile, now = performance.now(), labelLayer = null) {
    void now;
    if (width < 1 || height < 1) return;

    this._ensureSlots(cells);

    const marginX = isMobile ? 20 : 28;
    const marginY = isMobile ? 40 : 48;
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

    for (const { axis, cell } of this._slots) {
      _world.copy(cell.hit.position);
      _ndc.copy(_world).project(camera);
      if (_ndc.z > 1 || _ndc.z < -1) {
        cell.wallEl.style.visibility = "hidden";
        cell.wallEl.style.pointerEvents = "none";
        continue;
      }

      const layout = cell.layout;
      const tier = cell.tier ?? getTierStyle(cell.product.tier);
      const depthScale = tier.labelScale;

      cell.wallEl.style.visibility = "visible";
      cell.wallEl.style.pointerEvents = "auto";
      cell.labelEl.style.visibility = "visible";

      const box = this._measureWall(cell, layout, depthScale);
      const anchorPx = (_ndc.x * 0.5 + 0.5) * width;
      const anchorPy = (-_ndc.y * 0.5 + 0.5) * height;
      const slot = this._slotCenter(axis, cx, cy, width, height, box.hw, box.hh, bounds, layout.slotScale);

      let posX = layout.placed ? layout.cx : slot.x;
      let posY = layout.placed ? layout.cy : slot.y;

      if (this.physicsEnabled) {
        posX += (slot.x - posX) * 0.35;
        posY += (slot.y - posY) * 0.35;
      } else {
        posX = slot.x;
        posY = slot.y;
      }

      nodes.push({
        axis,
        cell,
        layout,
        depthScale,
        anchorPx,
        anchorPy,
        slotX: slot.x,
        slotY: slot.y,
        cx: posX,
        cy: posY,
        hw: box.hw,
        hh: box.hh,
        w: box.w,
        h: box.h,
        weight: layout.weight
      });
    }

    if (nodes.length === 0) return;

    for (const n of nodes) {
      if (this.physicsEnabled) this._nudgeTowardAnchor(n, n.anchorPx, n.anchorPy, 14);
    }

    this._resolveWallCollisions(nodes);
    this._clampWalls(nodes, bounds);
    this._resolveWallCollisions(nodes);
    this._clampWalls(nodes, bounds);
    this._resolveWallCollisions(nodes);

    if (this._countOverlaps(nodes) > 0) {
      for (let boost = 0; boost < 8; boost += 1) {
        for (const n of nodes) {
          const dx = n.cx - cx;
          const dy = n.cy - cy;
          const d = Math.hypot(dx, dy) || 1;
          n.cx += (dx / d) * 8;
          n.cy += (dy / d) * 8;
        }
        this._resolveWallCollisions(nodes);
        this._clampWalls(nodes, bounds);
        this._resolveWallCollisions(nodes);
        if (this._countOverlaps(nodes) === 0) break;
      }
    }

    for (const n of nodes) this._applyWallToDom(n, camera);

    if (labelLayer) {
      this._enforceDomWalls(nodes, labelLayer);
      this._clampWalls(nodes, bounds);
      this._resolveWallCollisions(nodes);
    }

    for (const n of nodes) this._applyWallToDom(n, camera);

    if (this.debug) this._updateDebugOverlay(nodes, width, height);
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
      html += `<div class="galaxy-layout-debug__box" style="left:${n.cx - n.hw}px;top:${n.cy - n.hh}px;width:${n.w}px;height:${n.h}px"></div>`;
      html += `<div class="galaxy-layout-debug__anchor" style="left:${n.anchorPx}px;top:${n.anchorPy}px"></div>`;
      html += `<div class="galaxy-layout-debug__pref" style="left:${n.slotX}px;top:${n.slotY}px"></div>`;
    }
    html += `<div class="galaxy-layout-debug__bounds" style="left:0;top:0;width:${width}px;height:${height}px"></div>`;
    html += `<div class="galaxy-layout-debug__hud">walls · left ${this.metrics.remainingOverlaps} · dom ${this.metrics.domOverlaps}</div>`;
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

/** @deprecated kept for imports */
export const AXIS_LABEL_OFFSETS = {};
