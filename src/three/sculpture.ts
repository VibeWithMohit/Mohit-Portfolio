import { BufferAttribute, SphereGeometry, Vector3 } from 'three';
import type { ProjectId } from '../content/projects';

/**
 * The sculpture: one closed glass surface that morphs between four forms.
 * Each form is a superquadric (a softened box between sphere and cube, with
 * separate roundness across and along its length), then optionally twisted
 * and bent. Every form is computed from the same sphere vertices, so blending
 * between them is a clean, continuous morph.
 *
 *   core          a thick, softly twisted glass tile — the default, and a
 *                 nod to the rounded panes of the interface itself
 *   beamtransfer  a gently curved light pipe — optical transmission
 *   ambiora       an arch — architecture and passage through space
 *   sggs-erp      a rounded glass block — a system, seen whole
 */
export type SculptureState = 'core' | ProjectId;

export const STATE_ORDER: readonly SculptureState[] = ['core', 'beamtransfer', 'ambiora', 'sggs-erp'];

interface ShapeParams {
  a: number; // half-length along x
  b: number; // half-height along y
  c: number; // half-depth along z
  n: number; // roundness of the cross-section (2 = elliptical, higher = squarer)
  m: number; // roundness along the length (2 = pointed ends, higher = flatter ends)
  twist: number; // radians of twist across the half-length
  bend: number; // curvature of the arch (1 / radius)
}

const SHAPES: Record<SculptureState, ShapeParams> = {
  core: { a: 1.24, b: 0.98, c: 0.44, n: 3.4, m: 3.4, twist: 0.5, bend: 0 },
  beamtransfer: { a: 1.6, b: 0.34, c: 0.34, n: 2, m: 5, twist: 0, bend: 0.14 },
  ambiora: { a: 1.5, b: 0.24, c: 0.62, n: 3, m: 3, twist: 0, bend: 1.05 },
  'sggs-erp': { a: 0.94, b: 0.94, c: 0.94, n: 4, m: 4, twist: 0.14, bend: 0 },
};

/** Largest distance from the origin any form reaches (plus wobble headroom). */
export const SCULPTURE_RADIUS = 1.62;

function shapePoint(dx: number, dy: number, dz: number, s: ShapeParams, out: Vector3): Vector3 {
  // Radial scale that puts the direction on the superquadric surface
  // (|y/b|^n + |z/c|^n)^(m/n) + |x/a|^m = 1 — homogeneous of degree m.
  const across = Math.pow(Math.pow(Math.abs(dy / s.b), s.n) + Math.pow(Math.abs(dz / s.c), s.n), s.m / s.n);
  const r = Math.pow(across + Math.pow(Math.abs(dx / s.a), s.m), -1 / s.m);
  let x = dx * r;
  let y = dy * r;
  let z = dz * r;
  if (s.twist) {
    const t = s.twist * (x / s.a);
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const ny = y * cos - z * sin;
    z = y * sin + z * cos;
    y = ny;
  }
  if (s.bend) {
    const R = 1 / s.bend;
    const theta = x / R;
    const rr = R + y;
    x = rr * Math.sin(theta);
    y = rr * Math.cos(theta) - R + (R - R * Math.cos(s.a / R)) * 0.5;
  }
  return out.set(x, y, z);
}

export interface SculptureForm {
  positions: Float32Array;
  normals: Float32Array;
}

/**
 * Evaluate one form for every vertex direction of the base sphere. Normals
 * are analytic (finite differences on the shape function) rather than
 * averaged from triangles, so the sphere's UV seam leaves no trace in the
 * refraction.
 */
export function computeForm(directions: Float32Array, state: SculptureState): SculptureForm {
  const s = SHAPES[state];
  const count = directions.length / 3;
  const positions = new Float32Array(directions.length);
  const normals = new Float32Array(directions.length);
  const d = new Vector3();
  const t1 = new Vector3();
  const t2 = new Vector3();
  const p = new Vector3();
  const p1 = new Vector3();
  const p2 = new Vector3();
  const helper = new Vector3();
  const eps = 1e-3;

  for (let i = 0; i < count; i++) {
    d.set(directions[i * 3]!, directions[i * 3 + 1]!, directions[i * 3 + 2]!).normalize();
    shapePoint(d.x, d.y, d.z, s, p);
    positions[i * 3] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;

    // Tangent frame around d.
    helper.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0);
    t1.crossVectors(d, helper).normalize();
    t2.crossVectors(d, t1).normalize();
    helper.copy(d).addScaledVector(t1, eps).normalize();
    shapePoint(helper.x, helper.y, helper.z, s, p1);
    helper.copy(d).addScaledVector(t2, eps).normalize();
    shapePoint(helper.x, helper.y, helper.z, s, p2);
    p1.sub(p);
    p2.sub(p);
    // (t1, t2, d) is right-handed, so cross(t1, t2) = d points outward; every
    // deformation here preserves orientation, so this normal is outward too —
    // including under the arch, where the surface is not star-shaped.
    const n = helper.crossVectors(p1, p2).normalize();
    normals[i * 3] = n.x;
    normals[i * 3 + 1] = n.y;
    normals[i * 3 + 2] = n.z;
  }
  return { positions, normals };
}

/** The base sphere (its positions are unit directions). */
export function createBaseSphere(widthSegments: number, heightSegments: number): SphereGeometry {
  return new SphereGeometry(1, widthSegments, heightSegments);
}

/**
 * Attach forms to the geometry: the core form becomes the base, the three
 * project forms become morph targets. Influences (one per project) blend
 * linearly, so any mix of weights summing to ≤ 1 is a valid in-between shape.
 */
export function applyForms(geometry: SphereGeometry, forms: Record<SculptureState, SculptureForm>): void {
  geometry.setAttribute('position', new BufferAttribute(forms.core.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(forms.core.normals, 3));
  const targets = STATE_ORDER.slice(1) as SculptureState[];
  geometry.morphAttributes.position = targets.map((state) => new BufferAttribute(forms[state].positions, 3));
  geometry.morphAttributes.normal = targets.map((state) => new BufferAttribute(forms[state].normals, 3));
  geometry.morphTargetsRelative = false;
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius = SCULPTURE_RADIUS;
}
