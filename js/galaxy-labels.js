import * as THREE from "three";
import { getTierStyle } from "./products-config.js";

const _world = new THREE.Vector3();
const _ndc = new THREE.Vector3();

/** Outward label anchors per tesseract cell axis */
export const AXIS_LABEL_OFFSETS = {
  "+X": new THREE.Vector3(1.45, 0.2, 0.2),
  "-X": new THREE.Vector3(-1.45, 0.15, -0.15),
  "+Y": new THREE.Vector3(0.1, 1.15, 0.35),
  "-Y": new THREE.Vector3(-0.05, -1.05, 0.25),
  "+Z": new THREE.Vector3(0.55, 0.3, 1.35),
  "-Z": new THREE.Vector3(-0.45, -0.2, -1.25)
};

/**
 * Screen-space label collision avoidance with smooth interpolation.
 */
export class GalaxyLabelLayout {
  constructor() {
    this.sizes = new Map();
  }

  /**
   * @param {Map<string, object>} cells
   * @param {THREE.Camera} camera
   * @param {number} width
   * @param {number} height
   * @param {boolean} isMobile
   */
  update(cells, camera, width, height, isMobile) {
    if (width < 1 || height < 1) return;

    const entries = [];
    for (const [axis, cell] of cells) {
      const base = AXIS_LABEL_OFFSETS[axis] ?? new THREE.Vector3(0, 0.8, 0);
      _world.copy(cell.hit.position).add(base);

      _ndc.copy(_world).project(camera);
      if (_ndc.z > 1) {
        cell.labelEl.style.visibility = "hidden";
        continue;
      }
      cell.labelEl.style.visibility = "visible";

      const tier = getTierStyle(cell.product.tier);
      const dist = camera.position.distanceTo(cell.hit.position);
      const depthScale = THREE.MathUtils.clamp(1.15 - dist * 0.035, 0.72, 1.08) * tier.labelScale;

      const w = (cell.labelEl.offsetWidth || 190) * depthScale;
      const h = (cell.labelEl.offsetHeight || 64) * depthScale;
      const px = (_ndc.x * 0.5 + 0.5) * width;
      const py = (-_ndc.y * 0.5 + 0.5) * height;

      cell.label.position.copy(_world);
      entries.push({
        axis,
        cell,
        px,
        py,
        w,
        h,
        priority: tier.priority,
        depthScale,
        ox: cell.labelPx.x,
        oy: cell.labelPx.y
      });
    }

    entries.sort((a, b) => b.priority - a.priority);

    const minGap = isMobile ? 14 : 18;
    const placed = [];

    for (const entry of entries) {
      let { px, py, ox, oy } = entry;
      ox = entry.cell.labelPx.x;
      oy = entry.cell.labelPx.y;

      for (let iter = 0; iter < 10; iter += 1) {
        for (const other of placed) {
          const dx = px + ox - (other.px + other.ox);
          const dy = py + oy - (other.py + other.oy);
          const overlapX = (entry.w + other.w) * 0.5 + minGap - Math.abs(dx);
          const overlapY = (entry.h + other.h) * 0.5 + minGap - Math.abs(dy);
          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              ox += overlapX * (dx >= 0 ? 1 : -1);
            } else {
              oy += overlapY * (dy >= 0 ? 1 : -1);
            }
          }
        }
      }

      // Keep labels away from center clutter
      const cx = width * 0.5;
      const cy = height * 0.5;
      const fromCenterX = px + ox - cx;
      const fromCenterY = py + oy - cy;
      const centerDist = Math.hypot(fromCenterX, fromCenterY);
      const minCenter = isMobile ? 90 : 120;
      if (centerDist < minCenter && centerDist > 0.001) {
        const push = (minCenter - centerDist) * 0.35;
        ox += (fromCenterX / centerDist) * push;
        oy += (fromCenterY / centerDist) * push;
      }

      const lerp = isMobile ? 0.14 : 0.1;
      entry.cell.labelPx.x += (ox - entry.cell.labelPx.x) * lerp;
      entry.cell.labelPx.y += (oy - entry.cell.labelPx.y) * lerp;

      const tierClass = entry.cell.product.tier || "secondary";
      entry.cell.labelEl.dataset.tier = tierClass;
      entry.cell.labelEl.style.transform =
        `translate(calc(-50% + ${entry.cell.labelPx.x.toFixed(1)}px), calc(-50% + ${entry.cell.labelPx.y.toFixed(1)}px)) scale(${entry.depthScale.toFixed(3)})`;

      placed.push({ px, py, ox: entry.cell.labelPx.x, oy: entry.cell.labelPx.y, w: entry.w, h: entry.h });
    }
  }
}
