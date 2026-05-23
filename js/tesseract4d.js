/**
 * Real 4D hypercube — canonical frame recompute every update (no accumulated transforms).
 */

const PROJECTION_MIN_DIVISOR = 0.15;
const DEFAULT_MAX_RADIUS_FACTOR = 2.45;

export class Tesseract4D {
  constructor() {
    /** Immutable canonical 4D vertices */
    this.baseVertices = [];
    for (let i = 0; i < 16; i += 1) {
      this.baseVertices.push([
        i & 1 ? 1 : -1,
        i & 2 ? 1 : -1,
        i & 4 ? 1 : -1,
        i & 8 ? 1 : -1
      ]);
    }

    this.edges = this._buildEdges();
    this.faces = this._buildFaces();
    this.cells = this._buildCells();

    /** Transient — rewritten every computeFrame() */
    this.rotated4D = new Float32Array(64);
    this.projectedBuffer = new Float32Array(48);
    this.edgeValid = new Uint8Array(32);
    this.vertexValid = new Uint8Array(16);

    this.stats = {
      clampedVertices: 0,
      maxRadius: 0,
      maxEdgeLength: 0,
      invalidEdges: 0,
      singularities: 0,
      stabilityScore: 1,
      frameId: 0
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
   * Fresh 4D rotation from canonical base — no forward accumulation.
   */
  _rotateIntoBuffer(time, xwRate, ywRate) {
    const theta = time * xwRate;
    const phi = time * ywRate;
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);
    const buf = this.rotated4D;

    for (let i = 0; i < 16; i += 1) {
      const [bx, by, bz, bw] = this.baseVertices[i];
      let x = bx * ct - bw * st;
      let w = bx * st + bw * ct;
      let y = by * cp - w * sp;
      w = by * sp + w * cp;
      const o = i * 4;
      buf[o] = x;
      buf[o + 1] = y;
      buf[o + 2] = bz;
      buf[o + 3] = w;
    }
  }

  _projectIntoBuffer(scale, maxRadius) {
    const r4 = this.rotated4D;
    const out = this.projectedBuffer;
    let clamped = 0;
    let singularities = 0;
    let maxR = 0;

    for (let i = 0; i < 16; i += 1) {
      const o4 = i * 4;
      const x = r4[o4];
      const y = r4[o4 + 1];
      const z = r4[o4 + 2];
      const w = r4[o4 + 3];
      const d = 2 - w;
      let valid = true;

      if (Math.abs(d) < PROJECTION_MIN_DIVISOR) singularities += 1;
      const safeD = Math.abs(d) < PROJECTION_MIN_DIVISOR ? (d >= 0 ? PROJECTION_MIN_DIVISOR : -PROJECTION_MIN_DIVISOR) : d;
      const f = 1 / safeD;
      let px = x * f * scale;
      let py = y * f * scale;
      let pz = z * f * scale;

      if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
        px = 0;
        py = 0;
        pz = 0;
        valid = false;
        clamped += 1;
      }

      const maxCoord = maxRadius;
      if (Math.abs(px) > maxCoord || Math.abs(py) > maxCoord || Math.abs(pz) > maxCoord) {
        px = Math.max(-maxCoord, Math.min(maxCoord, px));
        py = Math.max(-maxCoord, Math.min(maxCoord, py));
        pz = Math.max(-maxCoord, Math.min(maxCoord, pz));
        clamped += 1;
      }

      let r = Math.hypot(px, py, pz);
      if (r > maxRadius) {
        const s = maxRadius / r;
        px *= s;
        py *= s;
        pz *= s;
        r = maxRadius;
        clamped += 1;
      }
      if (r > maxR) maxR = r;

      const o3 = i * 3;
      out[o3] = px;
      out[o3 + 1] = py;
      out[o3 + 2] = pz;
      this.vertexValid[i] = valid && r > 0.0001 ? 1 : 0;
    }

    return { clamped, singularities, maxR };
  }

  _validateEdges(maxEdgeLen) {
    const buf = this.projectedBuffer;
    let invalid = 0;
    let maxEdge = 0;

    for (let e = 0; e < this.edges.length; e += 1) {
      const [a, b] = this.edges[e];
      if (!this.vertexValid[a] || !this.vertexValid[b]) {
        this.edgeValid[e] = 0;
        invalid += 1;
        continue;
      }
      const oa = a * 3;
      const ob = b * 3;
      const dx = buf[oa] - buf[ob];
      const dy = buf[oa + 1] - buf[ob + 1];
      const dz = buf[oa + 2] - buf[ob + 2];
      const len = Math.hypot(dx, dy, dz);
      if (len > maxEdge) maxEdge = len;
      if (!Number.isFinite(len) || len < 0.0001 || len > maxEdgeLen) {
        this.edgeValid[e] = 0;
        invalid += 1;
      } else {
        this.edgeValid[e] = 1;
      }
    }
    return { invalid, maxEdge };
  }

  /**
   * Single canonical pipeline entry — call once per frame per tesseract instance.
   */
  computeFrame(time, xwRate, ywRate, scale, maxRadiusFactor = DEFAULT_MAX_RADIUS_FACTOR, maxEdgeLen = 4.5) {
    this.stats.frameId += 1;
    const maxRadius = scale * maxRadiusFactor;

    this._rotateIntoBuffer(time, xwRate, ywRate);
    const proj = this._projectIntoBuffer(scale, maxRadius);
    const edge = this._validateEdges(maxEdgeLen);

    const clampRatio = proj.clamped / 16;
    const singRatio = proj.singularities / 16;
    const edgeRatio = edge.invalid / this.edges.length;
    const stabilityScore = Math.max(0, 1 - clampRatio * 0.55 - singRatio * 0.35 - edgeRatio * 0.4);

    this.stats.clampedVertices = proj.clamped;
    this.stats.singularities = proj.singularities;
    this.stats.maxRadius = proj.maxR;
    this.stats.maxEdgeLength = edge.maxEdge;
    this.stats.invalidEdges = edge.invalid;
    this.stats.stabilityScore = stabilityScore;

    return {
      buffer: this.projectedBuffer,
      stats: this.stats,
      stable: stabilityScore > 0.55
    };
  }

  /** Legacy API — delegates to computeFrame */
  rotate(time, xwRate = 0.15, ywRate = 0.1) {
    this._rotateIntoBuffer(time, xwRate, ywRate);
  }

  fillProjectedVertices(scale, maxRadiusFactor = DEFAULT_MAX_RADIUS_FACTOR) {
    const maxRadius = scale * maxRadiusFactor;
    this._projectIntoBuffer(scale, maxRadius);
    return this.projectedBuffer;
  }

  getCellCenterFromBuffer(cellKey) {
    const indices = this.cells[cellKey];
    if (!indices?.length) return { x: 0, y: 0, z: 0 };
    const buf = this.projectedBuffer;
    let x = 0;
    let y = 0;
    let z = 0;
    let n = 0;
    for (const i of indices) {
      if (!this.vertexValid[i]) continue;
      const o = i * 3;
      x += buf[o];
      y += buf[o + 1];
      z += buf[o + 2];
      n += 1;
    }
    if (!n) return { x: 0, y: 0, z: 0 };
    return { x: x / n, y: y / n, z: z / n };
  }

  getCellCenter(cellKey, scale) {
    this.fillProjectedVertices(scale);
    return this.getCellCenterFromBuffer(cellKey);
  }
}
