/**
 * Real 4D hypercube topology with XW/YW rotation and perspective projection.
 */
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

    /** @type {[number, number, number, number][]} */
    this.state = this.baseVertices.map((v) => [...v]);
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
      let [x, y, z, w] = this.baseVertices[i];
      let nx = x * ct - w * st;
      let nw = x * st + w * ct;
      x = nx;
      w = nw;
      let ny = y * cp - w * sp;
      nw = y * sp + w * cp;
      y = ny;
      w = nw;
      this.state[i] = [x, y, z, w];
    }
  }

  /**
   * @param {[number, number, number, number]} v4
   * @param {number} scale
   */
  projectVertex(v4, scale = 2.5) {
    const [x, y, z, w] = v4;
    const d = 2 - w;
    const safeD = Math.abs(d) < 0.08 ? (d >= 0 ? 0.08 : -0.08) : d;
    const f = 1 / safeD;
    const px = x * f * scale;
    const py = y * f * scale;
    const pz = z * f * scale;
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) {
      return { x: 0, y: 0, z: 0 };
    }
    return { x: px, y: py, z: pz };
  }

  /** @param {number} scale @returns {{ x: number, y: number, z: number }[]} */
  getProjectedVertices(scale) {
    return this.state.map((v) => this.projectVertex(v, scale));
  }

  /** @param {string} cellKey @returns {{ x: number, y: number, z: number }} */
  getCellCenter(cellKey, scale) {
    const indices = this.cells[cellKey];
    if (!indices?.length) return { x: 0, y: 0, z: 0 };
    let x = 0;
    let y = 0;
    let z = 0;
    for (const i of indices) {
      const p = this.projectVertex(this.state[i], scale);
      x += p.x;
      y += p.y;
      z += p.z;
    }
    const n = indices.length;
    return { x: x / n, y: y / n, z: z / n };
  }
}
