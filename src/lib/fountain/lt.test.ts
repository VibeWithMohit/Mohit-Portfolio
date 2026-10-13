import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../random';
import { LTDecoder, LTEncoder, neighbours, robustSolitonCDF } from './lt';

function randomBytes(length: number, seed: number): Uint8Array {
  const rand = mulberry32(seed);
  return Uint8Array.from({ length }, () => Math.floor(rand() * 256));
}

/** Stream droplets through a channel that drops a fraction of them. */
function transmit(message: Uint8Array, blockSize: number, loss: number, seed: number) {
  const encoder = new LTEncoder(message, blockSize, seed);
  const decoder = new LTDecoder(encoder.k, blockSize, message.length);
  const channel = mulberry32(seed ^ 0xa5a5a5a5);
  let sent = 0;
  while (!decoder.complete && sent < encoder.k * 20) {
    const droplet = encoder.droplet(sent++);
    if (channel() >= loss) decoder.add(droplet);
  }
  return { encoder, decoder, sent };
}

describe('robustSolitonCDF', () => {
  it('is a monotone distribution ending at exactly 1', () => {
    for (const k of [1, 2, 8, 16, 63, 500]) {
      const cdf = robustSolitonCDF(k);
      expect(cdf[k]).toBe(1);
      for (let d = 2; d <= k; d++) expect(cdf[d]!).toBeGreaterThanOrEqual(cdf[d - 1]!);
    }
  });

  it('rejects invalid block counts', () => {
    expect(() => robustSolitonCDF(0)).toThrow(RangeError);
    expect(() => robustSolitonCDF(2.5)).toThrow(RangeError);
  });
});

describe('neighbours', () => {
  it('is deterministic for a seed and yields distinct, in-range indices', () => {
    const k = 40;
    const cdf = robustSolitonCDF(k);
    for (let seed = 1; seed < 500; seed++) {
      const a = neighbours(seed, k, cdf);
      expect(neighbours(seed, k, cdf)).toEqual(a);
      expect(new Set(a).size).toBe(a.length);
      for (const i of a) expect(i >= 0 && i < k).toBe(true);
    }
  });
});

describe('LT round trip', () => {
  it('reconstructs a message exactly over a lossless channel', () => {
    const message = randomBytes(1000, 7);
    const { decoder } = transmit(message, 16, 0, 11);
    expect(decoder.complete).toBe(true);
    expect(decoder.result()).toEqual(message);
  });

  it('reconstructs exactly despite 40% frame loss', () => {
    for (const seed of [3, 19, 42, 77, 1234]) {
      const message = randomBytes(777, seed);
      const { decoder } = transmit(message, 12, 0.4, seed);
      expect(decoder.complete).toBe(true);
      expect(decoder.result()).toEqual(message);
    }
  });

  it('handles a message shorter than one block and a ragged final block', () => {
    for (const text of ['hi', 'Systems in motion — sent through a lossy channel.']) {
      const message = new TextEncoder().encode(text);
      const { decoder } = transmit(message, 5, 0.25, 99);
      expect(new TextDecoder().decode(decoder.result()!)).toBe(text);
    }
  });

  it('needs only modest overhead on average', () => {
    let totalReceived = 0;
    let totalBlocks = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { decoder } = transmit(randomBytes(64 * 8, seed), 8, 0, seed);
      totalReceived += decoder.received;
      totalBlocks += decoder.k;
    }
    // LT codes at k = 64 typically need ~1.2–1.6× the block count.
    expect(totalReceived / totalBlocks).toBeLessThan(1.9);
  });

  it('withholds a result until every block is known', () => {
    const message = randomBytes(256, 5);
    const encoder = new LTEncoder(message, 8, 5);
    const decoder = new LTDecoder(encoder.k, 8, message.length);
    decoder.add(encoder.droplet(0));
    expect(decoder.complete).toBe(false);
    expect(decoder.result()).toBeNull();
  });
});
