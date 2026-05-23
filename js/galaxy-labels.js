import * as THREE from "three";
import { getTierStyle } from "./products-config.js";

const _world = new THREE.Vector3();
const _ndc = new THREE.Vector3();
const _force = { x: 0, y: 0 };

/** World-space anchor bias per cell axis (outward from tesseract center) */
export const AXIS_LABEL_OFFSETS = {
  "+X": new THREE.Vector3(1.55, 0.15, 0.25),
  "-X": new THREE.Vector3(-1.55, 0.1, -0.2),
  "+Y": new THREE.Vector3(0.05, 1.25, 0.4),
  "-Y": new THREE.Vector3(-0.05, -1.15, 0.3),
  "+Z": new THREE.Vector3(0.65, 0.25, 1.45),
  "-Z": new THREE.Vector3(-0.5, -0.15, -1.35)
};

/** Preferred screen-space resting bias (normalized -1..1) by product hierarchy zone */
const AXIS_SCREEN_BIAS = {
  "+X": { x: 0.24, y: -0.02 },
  "-X": { x: -0.24, y: -0.02 },
  "+Y": { x: 0.04, y: 0.22 },
  "-Y": { x: 0.14, y: -0.2 },
  "+Z": { x: 0.16, y: 0.06 },
  "-Z": { x: -0.14, y: -0.14 }
};

const SPRING = 42;
const DAMPING = 11;
const REPULSION = 8800;
const CENTER_REPULSION = 420;
const WALL_STIFFNESS = 38;
const MAX_VEL = 420;
const MAX_OFFSET = 280;

/**
 * Spring-damper label physics with screen-space containment and collision repulsion.
 */
export class GalaxyLabelLayout {
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.physicsEnabled]
   * @param {boolean} [opts.debug]
   */
  constructor(opts = {}) {
    this.physicsEnabled = opts.physicsEnabled !== false;
    this.debug = opts.debug === true;
    this.lastTime = performance.now();
    this.metrics = {
      overlaps: 0,
      wallHits: 0,
      maxVelocity: 0,
      avgOffset: 0
    };
    /** @type {object[]} pooled simulation bodies */
    this.bodies = [];
    this._initialized = false;
    this.debugGroup = null;
  }

  /**
   * @param {Map<string, object>} cells
   */
  _ensureBodies(cells) {
    if (this._initialized) return;
    this.bodies.length = 0;
    for (const [axis, cell] of cells) {
      const tier = getTierStyle(cell.product.tier);
      const bias = AXIS_SCREEN_BIAS[axis] ?? { x: 0, y: 0 };
      cell.physics = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        restBiasX: bias.x,
        restBiasY: bias.y,
        priority: tier.priority,
        mass: 0.85 + tier.priority * 0.12
      };
      this.bodies.push({ axis, cell });
    }
    this.bodies.sort((a, b) => b.cell.physics.priority - a.cell.physics.priority);
    this._initialized = true;
  }

  /**
   * @param {Map<string, object>} cells
   * @param {THREE.Camera} camera
   * @param {number} width
   * @param {number} height
   * @param {boolean} isMobile
   * @param {number} [now]
   */
  update(cells, camera, width, height, isMobile, now = performance.now()) {
    if (width < 1 || height < 1) return;

    this._ensureBodies(cells);

    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(Math.max(dt, 0.001), 0.033);

    const marginX = isMobile ? 28 : 36;
    const marginY = isMobile ? 48 : 56;
    const minCenter = isMobile ? 105 : 135;
    const minSep = isMobile ? 16 : 22;
    const cx = width * 0.5;
    const cy = height * 0.5;

    this.metrics.overlaps = 0;
    this.metrics.wallHits = 0;
    this.metrics.maxVelocity = 0;
    let offsetSum = 0;

    /** @type {{ cell: object, px: number, py: number, w: number, h: number, z: number }[]} */
    const anchors = [];

    for (const { axis, cell } of this.bodies) {
      _world.copy(cell.hit.position);
      const offset = AXIS_LABEL_OFFSETS[axis];
      if (offset) _world.add(offset);
      else _world.y += 0.9;

      _ndc.copy(_world).project(camera);
      if (_ndc.z > 1 || _ndc.z < -1) {
        cell.labelEl.style.visibility = "hidden";
        continue;
      }
      cell.labelEl.style.visibility = "visible";
      cell.label.position.copy(_world);

      const tier = cell.tier ?? getTierStyle(cell.product.tier);
      const depthScale = THREE.MathUtils.clamp(1.12 - camera.position.distanceTo(cell.hit.position) * 0.032, 0.7, 1.1) * tier.labelScale;
      const w = (cell.labelEl.offsetWidth || 190) * depthScale;
      const h = (cell.labelEl.offsetHeight || 64) * depthScale;
      const px = (_ndc.x * 0.5 + 0.5) * width;
      const py = (-_ndc.y * 0.5 + 0.5) * height;

      anchors.push({ cell, px, py, w, h, z: _ndc.z, depthScale, axis });
    }

    if (!this.physicsEnabled) {
      for (const a of anchors) {
        a.cell.labelPx.x = 0;
        a.cell.labelPx.y = 0;
        this._applyTransform(a.cell, a.depthScale);
      }
      return;
    }

    for (let i = 0; i < anchors.length; i += 1) {
      const a = anchors[i];
      const p = a.cell.physics;
      const targetX = p.restBiasX * width * 0.28;
      const targetY = p.restBiasY * height * 0.22;

      _force.x = (targetX - p.x) * SPRING - p.vx * DAMPING;
      _force.y = (targetY - p.y) * SPRING - p.vy * DAMPING;

      const fcx = a.px + p.x - cx;
      const fcy = a.py + p.y - cy;
      const cd = Math.hypot(fcx, fcy);
      if (cd < minCenter && cd > 0.001) {
        const push = ((minCenter - cd) / minCenter) * CENTER_REPULSION;
        _force.x += (fcx / cd) * push;
        _force.y += (fcy / cd) * push;
      }

      for (let j = 0; j < anchors.length; j += 1) {
        if (i === j) continue;
        const b = anchors[j];
        const bp = b.cell.physics;
        const dx = a.px + p.x - (b.px + bp.x);
        const dy = a.py + p.y - (b.py + bp.y);
        const dist = Math.hypot(dx, dy);
        const minDist = (a.w + b.w) * 0.5 + minSep;
        if (dist < minDist && dist > 0.001) {
          this.metrics.overlaps += 1;
          const overlap = minDist - dist;
          const strength = (REPULSION * overlap) / (p.mass * dist * dist + 120);
          _force.x += (dx / dist) * strength;
          _force.y += (dy / dist) * strength;
        }
      }

      const left = marginX + a.w * 0.5;
      const right = width - marginX - a.w * 0.5;
      const top = marginY + a.h * 0.5;
      const bottom = height - marginY - a.h * 0.5;
      const sx = a.px + p.x;
      const sy = a.py + p.y;

      if (sx < left) {
        _force.x += (left - sx) * WALL_STIFFNESS;
        this.metrics.wallHits += 1;
      } else if (sx > right) {
        _force.x -= (sx - right) * WALL_STIFFNESS;
        this.metrics.wallHits += 1;
      }
      if (sy < top) {
        _force.y += (top - sy) * WALL_STIFFNESS;
        this.metrics.wallHits += 1;
      } else if (sy > bottom) {
        _force.y -= (sy - bottom) * WALL_STIFFNESS;
        this.metrics.wallHits += 1;
      }

      p.vx += (_force.x / p.mass) * dt;
      p.vy += (_force.y / p.mass) * dt;

      const vm = Math.hypot(p.vx, p.vy);
      if (vm > MAX_VEL) {
        p.vx = (p.vx / vm) * MAX_VEL;
        p.vy = (p.vy / vm) * MAX_VEL;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const om = Math.hypot(p.x, p.y);
      if (om > MAX_OFFSET) {
        p.x = (p.x / om) * MAX_OFFSET;
        p.y = (p.y / om) * MAX_OFFSET;
        p.vx *= 0.5;
        p.vy *= 0.5;
      }

      p.vx *= 1 - Math.min(0.4, DAMPING * dt * 0.08);
      p.vy *= 1 - Math.min(0.4, DAMPING * dt * 0.08);

      a.cell.labelPx.x = p.x;
      a.cell.labelPx.y = p.y;

      if (vm > this.metrics.maxVelocity) this.metrics.maxVelocity = vm;
      offsetSum += om;

      a.cell.labelEl.dataset.tier = a.cell.product.tier || "secondary";
      this._applyTransform(a.cell, a.depthScale);
    }

    this.metrics.avgOffset = anchors.length ? offsetSum / anchors.length : 0;
  }

  _applyTransform(cell, depthScale) {
    cell.labelEl.style.transform =
      `translate(calc(-50% + ${cell.labelPx.x.toFixed(2)}px), calc(-50% + ${cell.labelPx.y.toFixed(2)}px)) scale(${depthScale.toFixed(3)})`;
  }

  /**
   * @param {THREE.Scene} scene
   * @param {number} radius
   */
  attachDebugVolume(scene, radius = 3.2) {
    if (this.debugGroup) return this.debugGroup;
    const geo = new THREE.BoxGeometry(radius * 2, radius * 2, radius * 2);
    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.25 })
    );
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.08 })
    );
    this.debugGroup = new THREE.Group();
    this.debugGroup.add(line);
    this.debugGroup.add(sphere);
    scene.add(this.debugGroup);
    return this.debugGroup;
  }
}
