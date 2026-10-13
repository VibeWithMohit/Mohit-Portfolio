import { describe, expect, it } from 'vitest';
import { applyHomography, invert3, isConvexQuad, solveHomography, solveLinear, type Point } from './homography';

const unit: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

const skewed: Point[] = [
  { x: 112, y: 64 },
  { x: 498, y: 101 },
  { x: 540, y: 430 },
  { x: 80, y: 388 },
];

describe('solveLinear', () => {
  it('solves a small system', () => {
    const x = solveLinear(
      [
        [2, 1],
        [1, 3],
      ],
      [3, 5],
    );
    expect(x[0]).toBeCloseTo(0.8, 10);
    expect(x[1]).toBeCloseTo(1.4, 10);
  });

  it('rejects singular systems', () => {
    expect(() =>
      solveLinear(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2],
      ),
    ).toThrow('Degenerate configuration');
  });
});

describe('solveHomography', () => {
  it('maps each source corner exactly onto its destination', () => {
    const h = solveHomography(unit, skewed);
    unit.forEach((p, i) => {
      const q = applyHomography(h, p);
      expect(q.x).toBeCloseTo(skewed[i]!.x, 6);
      expect(q.y).toBeCloseTo(skewed[i]!.y, 6);
    });
  });

  it('is undone by its inverse', () => {
    const h = solveHomography(unit, skewed);
    const inv = invert3(h);
    for (const p of [
      { x: 0.25, y: 0.5 },
      { x: 0.9, y: 0.1 },
      { x: 0.5, y: 0.5 },
    ]) {
      const back = applyHomography(inv, applyHomography(h, p));
      expect(back.x).toBeCloseTo(p.x, 8);
      expect(back.y).toBeCloseTo(p.y, 8);
    }
  });

  it('reduces to the identity for identical quads', () => {
    const h = solveHomography(skewed, skewed);
    const expected = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    h.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 8));
  });

  it('rejects degenerate (collinear) input', () => {
    const line = [0, 1, 2, 3].map((i) => ({ x: i, y: i }));
    expect(() => solveHomography(line, skewed)).toThrow('Degenerate configuration');
  });
});

describe('isConvexQuad', () => {
  it('accepts convex quads in either winding', () => {
    expect(isConvexQuad(skewed)).toBe(true);
    expect(isConvexQuad([...skewed].reverse())).toBe(true);
  });

  it('rejects self-intersecting and degenerate quads', () => {
    const bowtie = [skewed[0]!, skewed[2]!, skewed[1]!, skewed[3]!];
    expect(isConvexQuad(bowtie)).toBe(false);
    expect(isConvexQuad([unit[0]!, unit[0]!, unit[1]!, unit[2]!])).toBe(false);
  });
});
