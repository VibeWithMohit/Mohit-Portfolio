/**
 * Planar homography from four point correspondences — the projective
 * transform behind document perspective correction. Solved directly as an
 * 8×8 linear system (h33 fixed to 1) with partial-pivot elimination.
 */
export interface Point {
  x: number;
  y: number;
}

/** Row-major 3×3 matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export function solveLinear(matrix: number[][], rhs: number[]): number[] {
  const n = rhs.length;
  const m = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-10) throw new Error('Degenerate configuration: points are collinear or repeated');
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const pivotRow = m[col]!;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const row = m[r]!;
      const factor = row[col]! / pivotRow[col]!;
      if (factor === 0) continue;
      for (let c = col; c <= n; c++) row[c] = row[c]! - factor * pivotRow[c]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** H such that H·src[i] ∝ dst[i] for all four pairs. */
export function solveHomography(src: readonly Point[], dst: readonly Point[]): Mat3 {
  if (src.length !== 4 || dst.length !== 4) throw new RangeError('Exactly four point pairs are required');
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!;
    const { x: u, y: v } = dst[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(a, b);
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

export function applyHomography(h: Mat3, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

export function invert3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error('Matrix is singular');
  const s = 1 / det;
  return [
    A * s,
    -(b * i - c * h) * s,
    (b * f - c * e) * s,
    B * s,
    (a * i - c * g) * s,
    -(a * f - c * d) * s,
    C * s,
    -(a * h - b * g) * s,
    (a * e - b * d) * s,
  ];
}

/** True when the quad (in order) is convex and non-degenerate — required for a sane rectification. */
export function isConvexQuad(points: readonly Point[]): boolean {
  if (points.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % 4]!;
    const r = points[(i + 2) % 4]!;
    const cross = (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
    if (Math.abs(cross) < 1e-6) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}
