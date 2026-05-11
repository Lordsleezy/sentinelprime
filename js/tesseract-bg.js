/**
 * Fixed full-viewport 4D hypercube (tesseract) wireframe.
 * Rotates in 4D, projects to 3D with perspective, then to 2D canvas.
 * Opacity is controlled via CSS on .tesseract-bg-canvas (~0.15).
 */
(function () {
  if (document.body.dataset.noTesseract === "true") return;

  const canvas = document.createElement("canvas");
  canvas.className = "tesseract-bg-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext("2d");
  let cssW = 0;
  let cssH = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 16 vertices of {-1,1}^4 */
  const base = [];
  for (let i = 0; i < 16; i += 1) {
    base.push([
      (i & 1) * 2 - 1,
      ((i >> 1) & 1) * 2 - 1,
      ((i >> 2) & 1) * 2 - 1,
      ((i >> 3) & 1) * 2 - 1
    ]);
  }

  const edges = [];
  for (let i = 0; i < 16; i += 1) {
    for (let j = i + 1; j < 16; j += 1) {
      let diff = 0;
      for (let k = 0; k < 4; k += 1) {
        if (base[i][k] !== base[j][k]) diff += 1;
      }
      if (diff === 1) edges.push([i, j]);
    }
  }

  function rotPlane(v, i, j, ang) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const out = v.slice();
    const vi = out[i];
    const vj = out[j];
    out[i] = vi * c - vj * s;
    out[j] = vi * s + vj * c;
    return out;
  }

  function transform4(v, t) {
    let r = v.slice();
    r = rotPlane(r, 0, 3, t * 0.74);
    r = rotPlane(r, 1, 3, t * 0.58);
    r = rotPlane(r, 2, 3, t * 0.41);
    r = rotPlane(r, 0, 1, t * 0.31);
    r = rotPlane(r, 1, 2, t * 0.27);
    r = rotPlane(r, 0, 2, t * 0.22);
    return r;
  }

  function project(x, y, z, w4) {
    const dist = 2.85;
    const denom = dist - w4;
    if (Math.abs(denom) < 0.08) return null;
    const scale = Math.min(cssW, cssH) * 0.22;
    const px = (x / denom) * scale + cssW * 0.5;
    const py = (y / denom) * scale + cssH * 0.5;
    return [px, py];
  }

  let t = 0;

  function frame() {
    t += 0.0075;
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.strokeStyle = "rgba(0, 212, 255, 0.85)";
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";

    const projected = base.map((v) => {
      const p = transform4(v, t);
      return project(p[0] * 0.92, p[1] * 0.92, p[2] * 0.92, p[3] * 0.92);
    });

    for (let e = 0; e < edges.length; e += 1) {
      const a = projected[edges[e][0]];
      const b = projected[edges[e][1]];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();
  requestAnimationFrame(frame);
})();
