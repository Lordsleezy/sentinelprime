/**
 * Real 4D hypercube topology with XW/YW rotation and stabilized perspective projection.
 */

const PROJECTION_MIN_DIVISOR = 0.12;
const DEFAULT_MAX_RADIUS_FACTOR = 2.65;

export class Tesseract4D {
  constructor() {
    /** @type {[number, number, number, number][]} */
    this.baseVertices = [];
    for (let i = 0; i < 16; i += 1) {
      this.baseVertices.push([
        i & 1 ? 1 : -1,
        i & 2 ? 1 : -1,
        i & 4 ? 1 : -1,
        i & 8 ? 1 : -1
      ]);
    }

    /** @type {[number, number][]} */
    this.edges = this._buildEdges();
    /** @type {number[][]} */
    this.faces = this._buildFaces();
    /** @type {Record<string, number[]>} */
    this.cells = this._buildCells();

    /** Recomputed from baseVertices every rotate() — no cumulative 4D drift. */
    /** @type {[number, number, number, number][]} */
    this.state = this.baseVertices.map((v) => [...v]);

    /** @type {Float32Array} 16 * 3 stabilized projected coordinates */
    this.projectedBuffer = new Float32Array(48);

    this.stats = {
      clampedVertices: 0,
      maxRadius: 0,
      singularities: 0
    };
  }

  _indexOf(v4) {
    for (let i = 0; i < 16; i += 1) {
      const b = this.baseVertices[i];
      if (b[0] === v4[0] && b[1] === v4[1] && b[2] === v4[2] && b[3] === v4[3]) return i;
    }
    return 0;
  }

  _buildEdges() {
    const edges = [];
    for (let i = 0; i < 16; i += 1) {
      for (let j = i + 1; j < 16; j += 1) {
        let diff = 0;
        for (let k = 0; k < 4; k += 1) {
          if (this.baseVertices[i][k] !== this.baseVertices[j][k]) diff += 1;
        }
        if (diff === 1) edges.push([i, j]);
      }
    }
    return edges;
  }

  _buildCells() {
    const axes = ["X", "Y", "Z", "W"];
    /** @type {Record<string, number[]>} */
    const cells = {};
    for (let dim = 0; dim < 4; dim += 1) {
      for (const sign of [1, -1]) {
        const key = `${sign > 0 ? "+" : "-"}${axes[dim]}`;
        cells[key] = [];
        for (let i = 0; i < 16; i += 1) {
          if (this.baseVertices[i][dim] === sign) cells[key].push(i);
        }
      }
    }
    return cells;
  }

  _buildFaces() {
    const faces = [];
    const dims = [0, 1, 2, 3];
    for (let a = 0; a < 4; a += 1) {
      for (let b = a + 1; b < 4; b += 1) {
        const fixed = dims.filter((d) => d !== a && d !== b);
        for (const s0 of [-1, 1]) {
          for (const s1 of [-1, 1]) {
            const corners = [];
            for (const va of [-1, 1]) {
              for (const vb of [-1, 1]) {
                const v = [0, 0, 0, 0];
                v[a] = va;
                v[b] = vb;
                v[fixed[0]] = s0;
                v[fixed[1]] = s1;
                corners.push(this._indexOf(v));
              }
            }
            faces.push([corners[0], corners[1], corners[3], corners[2]]);
          }
        }
      }
    }
    return faces;
  }

  /**
   * Deterministic rotation from base vertices — resets state each call (no drift).
   * @param {number} time
   * @param {number} [xwRate]
   * @param {number} [ywRate]
   */
  rotate(time, xwRate = 0.15, ywRate = 0.1) {
    const theta = time * xwRate;
    const phi = time * ywRate;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);

    for (let i = 0; i < 16; i += 1) {
      const [bx, by, bz, bw] = this.baseVertices[i];
      let x = bx * ct - bw * st;
      let w = bx * st + bw * ct;
      let y = by * cp - w * sp;
      w = by * sp + w * cp;
      const z = bz;
      this.state[i][0] = x;
      this.state[i][1] = y;
      this.state[i][2] = z;
      this.state[i][3] = w;
    }
  }

  /**
   * Stabilized perspective projection with safe divisor and radial clamp.
   * @param {[number, number, number, number]} v4
   * @param {number} scale
   * @param {number} maxRadius
   * @param {number} outOffset index into projectedBuffer (vertex index * 3)
   * @returns {boolean} true if vertex was clamped
   */
  projectVertexInto(v4, scale, maxRadius, outOffset) {
    const [x, y, z, w] = v4;
    const d = 2 - w;
    let clamped = false;

    if (Math.abs(d) < PROJECTION_MIN_DIVISOR) {
      this.stats.singularities += 1;
      clamped = true;
    }

    const safeD = Math.abs(d) < PROJECTION_MIN_DIVISOR ? (d >= 0 ? PROJECTION_MIN_DIVISOR : -PROJECTION_MIN_DIVISOR) : d;
    const f = 1 / safeD;
    let px = x * f * scale;
    let py = y * f * scale;
    let pz = z * f * scale;

    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
      px = 0;
      py = 0;
      pz = 0;
      clamped = true;
    }

    const ax = Math.abs(px);
    const ay = Math.abs(py);
    const az = Math.abs(pz);
    const maxCoord = maxRadius * 1.05;
    if (ax > maxCoord || ay > maxCoord || az > maxCoord) {
      px = Math.max(-maxCoord, Math.min(maxCoord, px));
      py = Math.max(-maxCoord, Math.min(maxCoord, py));
      pz = Math.max(-maxCoord, Math.min(maxCoord, pz));
      clamped = true;
    }

    const r = Math.hypot(px, py, pz);
    if (r > maxRadius) {
      const s = maxRadius / r;
      px *= s;
      py *= s;
      pz *= s;
      clamped = true;
    }

    if (r > this.stats.maxRadius) this.stats.maxRadius = r;

    const buf = this.projectedBuffer;
    buf[outOffset] = px;
    buf[outOffset + 1] = py;
    buf[outOffset + 2] = pz;
    return clamped;
  }

  /**
   * Fill projectedBuffer and return it. Resets stats each call.
   * @param {number} scale
   * @param {number} [maxRadiusFactor]
   */
  fillProjectedVertices(scale, maxRadiusFactor = DEFAULT_MAX_RADIUS_FACTOR) {
    const maxRadius = scale * maxRadiusFactor;
    this.stats.clampedVertices = 0;
    this.stats.maxRadius = 0;
    this.stats.singularities = 0;

    for (let i = 0; i < 16; i += 1) {
      if (this.projectVertexInto(this.state[i], scale, maxRadius, i * 3)) {
        this.stats.clampedVertices += 1;
      }
    }
    return this.projectedBuffer;
  }

  /** @param {number} scale @returns {{ x: number, y: number, z: number }[]} */
  getProjectedVertices(scale) {
    const buf = this.fillProjectedVertices(scale);
    const out = [];
    for (let i = 0; i < 16; i += 1) {
      const o = i * 3;
      out.push({ x: buf[o], y: buf[o + 1], z: buf[o + 2] });
    }
    return out;
  }

  /** @param {string} cellKey @param {number} scale @returns {{ x: number, y: number, z: number }} */
  getCellCenter(cellKey, scale) {
    const indices = this.cells[cellKey];
    if (!indices?.length) return { x: 0, y: 0, z: 0 };
    this.fillProjectedVertices(scale);

    let x = 0;
    let y = 0;
    let z = 0;
    const buf = this.projectedBuffer;
    for (const i of indices) {
      const o = i * 3;
      x += buf[o];
      y += buf[o + 1];
      z += buf[o + 2];
    }
    const n = indices.length;
    return { x: x / n, y: y / n, z: z / n };
  }
}
