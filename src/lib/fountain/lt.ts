import { hash32, mulberry32 } from '../random';

/**
 * A compact LT (Luby Transform) fountain code — the classic rateless erasure
 * code. Written for this site's visualisations; it is NOT BeamTransfer's
 * production codec.
 *
 * Encoding: the message is cut into k equal blocks. Each encoded droplet
 * picks a degree d from the robust soliton distribution, picks d distinct
 * blocks, and carries their XOR. The neighbour set is never transmitted —
 * only a 32-bit seed, from which sender and receiver derive the same set.
 *
 * Decoding (peeling / belief propagation): any droplet that reduces to a
 * single unknown block reveals it; that block is XORed out of every other
 * droplet that references it, which can expose further degree-1 droplets.
 */

export interface Droplet {
  /** Position in the endless droplet stream. */
  id: number;
  /** Seed from which the neighbour set is derived (travels in the frame header). */
  seed: number;
  /** Source block indices XORed into `data` (sorted). */
  indices: number[];
  data: Uint8Array;
}

export interface ReceivedDroplet {
  id: number;
  seed: number;
  data: Uint8Array;
}

/**
 * Robust soliton distribution (Luby, 2002) as a cumulative table over
 * degrees 1..k. `c` and `delta` are the usual tuning constants.
 */
export function robustSolitonCDF(k: number, c = 0.1, delta = 0.5): Float64Array {
  if (!Number.isInteger(k) || k < 1) throw new RangeError('k must be a positive integer');
  const cdf = new Float64Array(k + 1);
  if (k === 1) {
    cdf[1] = 1;
    return cdf;
  }
  const R = c * Math.log(k / delta) * Math.sqrt(k);
  const spike = Math.min(k, Math.max(1, Math.round(k / R)));
  const weights = new Float64Array(k + 1);
  let total = 0;
  for (let d = 1; d <= k; d++) {
    const rho = d === 1 ? 1 / k : 1 / (d * (d - 1));
    let tau = 0;
    if (d < spike) tau = R / (d * k);
    else if (d === spike) tau = Math.max(0, (R * Math.log(R / delta)) / k);
    weights[d] = rho + tau;
    total += rho + tau;
  }
  let acc = 0;
  for (let d = 1; d <= k; d++) {
    acc += weights[d]! / total;
    cdf[d] = acc;
  }
  cdf[k] = 1;
  return cdf;
}

/** Derive a droplet's neighbour set from its seed — identical on both ends. */
export function neighbours(seed: number, k: number, cdf: Float64Array): number[] {
  const rand = mulberry32(seed);
  const u = rand();
  let degree = 1;
  while (degree < k && cdf[degree]! < u) degree++;

  if (degree >= k) return Array.from({ length: k }, (_, i) => i);

  const picked = new Set<number>();
  while (picked.size < degree) picked.add(Math.floor(rand() * k));
  return [...picked].sort((a, b) => a - b);
}

function xorInto(target: Uint8Array, source: Uint8Array): void {
  for (let i = 0; i < target.length; i++) target[i]! ^= source[i]!;
}

export class LTEncoder {
  readonly k: number;
  readonly blockSize: number;
  readonly length: number;
  readonly streamSeed: number;
  private readonly blocks: Uint8Array[];
  private readonly cdf: Float64Array;

  constructor(message: Uint8Array, blockSize: number, streamSeed = 1) {
    if (!Number.isInteger(blockSize) || blockSize < 1) throw new RangeError('blockSize must be a positive integer');
    this.streamSeed = streamSeed;
    this.length = message.length;
    this.blockSize = blockSize;
    this.k = Math.max(1, Math.ceil(message.length / blockSize));
    this.blocks = Array.from({ length: this.k }, (_, i) => {
      const block = new Uint8Array(blockSize); // zero padding for the final block
      block.set(message.subarray(i * blockSize, (i + 1) * blockSize));
      return block;
    });
    this.cdf = robustSolitonCDF(this.k);
  }

  /** The n-th droplet of the stream. Deterministic for a given stream seed. */
  droplet(n: number): Droplet {
    const seed = hash32(this.streamSeed, n);
    const indices = neighbours(seed, this.k, this.cdf);
    const data = new Uint8Array(this.blockSize);
    for (const i of indices) xorInto(data, this.blocks[i]!);
    return { id: n, seed, indices, data };
  }

  sourceBlock(i: number): Uint8Array {
    const block = this.blocks[i];
    if (!block) throw new RangeError(`No block ${i}`);
    return block;
  }
}

interface PendingDroplet {
  id: number;
  remaining: Set<number>;
  data: Uint8Array;
}

export interface DecoderSnapshot {
  solved: boolean[];
  /** Received droplets that still reference unknown blocks. */
  pending: { id: number; remaining: number[] }[];
}

export class LTDecoder {
  readonly k: number;
  readonly blockSize: number;
  readonly length: number;
  received = 0;
  redundant = 0;
  private solvedCount = 0;
  private readonly cdf: Float64Array;
  private readonly blocks: (Uint8Array | null)[];
  private pending: PendingDroplet[] = [];

  constructor(k: number, blockSize: number, length: number) {
    this.k = k;
    this.blockSize = blockSize;
    this.length = length;
    this.cdf = robustSolitonCDF(k);
    this.blocks = Array.from({ length: k }, () => null);
  }

  get solved(): number {
    return this.solvedCount;
  }

  get complete(): boolean {
    return this.solvedCount === this.k;
  }

  isSolved(i: number): boolean {
    return this.blocks[i] != null;
  }

  block(i: number): Uint8Array | null {
    return this.blocks[i] ?? null;
  }

  /** Neighbour set a droplet *originally* referenced, re-derived from its seed. */
  neighboursOf(seed: number): number[] {
    return neighbours(seed, this.k, this.cdf);
  }

  /**
   * Accept a received droplet. Returns the indices of blocks solved as a
   * consequence, in the order the peeling process revealed them.
   */
  add(droplet: ReceivedDroplet): number[] {
    this.received++;
    const solvedNow: number[] = [];
    if (this.complete) {
      this.redundant++;
      return solvedNow;
    }

    const entry: PendingDroplet = {
      id: droplet.id,
      remaining: new Set(this.neighboursOf(droplet.seed)),
      data: droplet.data.slice(),
    };
    for (const i of [...entry.remaining]) {
      const known = this.blocks[i];
      if (known) {
        xorInto(entry.data, known);
        entry.remaining.delete(i);
      }
    }
    if (entry.remaining.size === 0) {
      this.redundant++;
      return solvedNow;
    }
    this.pending.push(entry);

    // Peel until no droplet of degree one remains.
    const ripple = this.pending.filter((p) => p.remaining.size === 1);
    while (ripple.length > 0) {
      const next = ripple.pop()!;
      if (next.remaining.size !== 1) continue; // already reduced by an earlier step
      const [index] = next.remaining;
      this.pending = this.pending.filter((p) => p !== next);
      if (index === undefined || this.blocks[index]) continue;

      this.blocks[index] = next.data;
      this.solvedCount++;
      solvedNow.push(index);

      for (const other of this.pending) {
        if (!other.remaining.has(index)) continue;
        xorInto(other.data, next.data);
        other.remaining.delete(index);
        if (other.remaining.size === 1) ripple.push(other);
      }
      this.pending = this.pending.filter((p) => p.remaining.size > 0);
    }
    return solvedNow;
  }

  snapshot(): DecoderSnapshot {
    return {
      solved: this.blocks.map((b) => b != null),
      pending: this.pending.map((p) => ({ id: p.id, remaining: [...p.remaining].sort((a, b) => a - b) })),
    };
  }

  /** The reconstructed message, or null until every block is known. */
  result(): Uint8Array | null {
    if (!this.complete) return null;
    const out = new Uint8Array(this.k * this.blockSize);
    this.blocks.forEach((block, i) => out.set(block!, i * this.blockSize));
    return out.subarray(0, this.length);
  }
}
