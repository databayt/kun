// Force-directed layout: Barnes–Hut repulsion, link springs, collision
// resolution, and an alpha cooling schedule.
//
// The two properties that matter here:
//   1. O(n log n) repulsion instead of O(n²). At ~300 nodes the naive pairwise
//      loop is ~45k distance checks per frame; the quadtree brings it to ~3k.
//   2. The simulation *cools and stops*. A layout that never settles pins a
//      core at 60fps for as long as the tab is open.
//
// The Obsidian-style extras: the four force constants are live-tunable (the
// Forces panel), and tick() takes a visibility mask so filtered-out nodes
// leave the layout entirely — toggling a group reflows the graph instead of
// leaving invisible ghosts holding space open.

export interface SimNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Draw radius, also used as collision radius and repulsion charge basis. */
  r: number;
}

export interface SimLink {
  source: number;
  target: number;
  /**
   * Per-relation multipliers. Typed edges are the whole point of the graph, so
   * the layout honours them: a containment edge pulls tight and short, a
   * cross-reference pulls loose and long. Uniform links would smear all the
   * clusters into one undifferentiated mass.
   */
  strength?: number;
  distance?: number;
}

interface Quad {
  x0: number;
  y0: number;
  half: number;
  mass: number;
  cx: number;
  cy: number;
  body: SimNode | null;
  kids: (Quad | null)[] | null;
}

const THETA = 0.9; // Barnes–Hut opening angle: cell/distance below this = one body
const ALPHA_MIN = 0.001;
const ALPHA_DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 420);
const VELOCITY_DECAY = 0.62;
const MAX_DEPTH = 20;

// Defaults for the tunable forces (the panel's neutral positions).
export const DEFAULT_CHARGE = -34; // per unit of radius
export const DEFAULT_LINK_DISTANCE = 30;
// Deliberately tiny. Centering is done by translating the centroid (see tick);
// this only stops a detached component from drifting off screen forever.
export const DEFAULT_CENTER_STRENGTH = 0.0011;

export class ForceSimulation {
  readonly nodes: SimNode[];
  private readonly links: SimLink[];
  /** d3-style bias: dense nodes yield less on a shared link. */
  private readonly linkBias: Float64Array;
  /**
   * Per-link strength, base/min(degree). Without the degree term a hub with 40
   * links gets yanked by all 40 at full force and the layout collapses.
   */
  private readonly linkStrength: Float64Array;
  private readonly linkDistance: Float64Array;
  private alpha = 1;
  private width: number;
  private height: number;

  // ── Live-tunable forces (Obsidian's Forces panel) ───────────────────────
  charge = DEFAULT_CHARGE;
  centerStrength = DEFAULT_CENTER_STRENGTH;
  linkForceScale = 1;
  linkDistanceScale = 1;

  constructor(count: number, links: SimLink[], radii: number[]) {
    this.links = links;
    this.width = 1200;
    this.height = 800;

    const degree = new Int32Array(count);
    for (const link of links) {
      degree[link.source]++;
      degree[link.target]++;
    }

    this.linkBias = new Float64Array(links.length);
    this.linkStrength = new Float64Array(links.length);
    this.linkDistance = new Float64Array(links.length);
    for (let i = 0; i < links.length; i++) {
      const { source, target } = links[i];
      this.linkBias[i] =
        degree[source] / (degree[source] + degree[target] || 1);
      this.linkStrength[i] =
        (links[i].strength ?? 1) /
        Math.max(1, Math.min(degree[source], degree[target]));
      this.linkDistance[i] = links[i].distance ?? DEFAULT_LINK_DISTANCE;
    }

    // Phyllotaxis seeding — deterministic (same layout on every reload) and
    // evenly spread, so the simulation never has to untangle a random knot.
    const spread = 12;
    this.nodes = Array.from({ length: count }, (_, i) => {
      const radius = spread * Math.sqrt(0.5 + i);
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      return {
        x: this.width / 2 + radius * Math.cos(angle),
        y: this.height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        r: radii[i],
      };
    });
  }

  get settled(): boolean {
    return this.alpha < ALPHA_MIN;
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    const dx = (width - this.width) / 2;
    const dy = (height - this.height) / 2;
    this.width = width;
    this.height = height;
    for (const node of this.nodes) {
      node.x += dx;
      node.y += dy;
    }
    this.reheat(0.3);
  }

  /** Nudge the simulation back to life after a drag, filter, or resize. */
  reheat(alpha = 0.45): void {
    this.alpha = Math.max(this.alpha, alpha);
  }

  /**
   * Advances one step. Returns false once the layout has come to rest.
   * `mask[i] === 0` removes node i from every force this tick.
   */
  tick(pinned: number | null, mask?: Uint8Array): boolean {
    if (this.settled) return false;
    this.alpha += (0 - this.alpha) * ALPHA_DECAY;

    const nodes = this.nodes;
    const alpha = this.alpha;
    const hidden = (i: number) => mask !== undefined && mask[i] === 0;

    // ── Repulsion (Barnes–Hut) ────────────────────────────────────────────
    const root = this.buildQuadtree(mask);
    if (root) {
      for (let i = 0; i < nodes.length; i++) {
        if (i === pinned || hidden(i)) continue;
        this.repel(root, nodes[i], alpha);
      }
    }

    // ── Link springs ──────────────────────────────────────────────────────
    for (let i = 0; i < this.links.length; i++) {
      const { source, target } = this.links[i];
      if (hidden(source) || hidden(target)) continue;
      const s = nodes[source];
      const t = nodes[target];
      let dx = t.x + t.vx - s.x - s.vx;
      let dy = t.y + t.vy - s.y - s.vy;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1e-6) {
        dx = 1e-3;
        dy = 0;
        dist = 1e-3;
      }
      const rest = this.linkDistance[i] * this.linkDistanceScale + s.r + t.r;
      const force =
        ((dist - rest) / dist) *
        alpha *
        this.linkStrength[i] *
        this.linkForceScale;
      dx *= force;
      dy *= force;
      const bias = this.linkBias[i];
      if (target !== pinned) {
        t.vx -= dx * bias;
        t.vy -= dy * bias;
      }
      if (source !== pinned) {
        s.vx += dx * (1 - bias);
        s.vy += dy * (1 - bias);
      }
    }

    // ── Integration ───────────────────────────────────────────────────────
    const cx = this.width / 2;
    const cy = this.height / 2;
    for (let i = 0; i < nodes.length; i++) {
      if (i === pinned || hidden(i)) continue;
      const node = nodes[i];
      node.vx += (cx - node.x) * this.centerStrength * alpha;
      node.vy += (cy - node.y) * this.centerStrength * alpha;
      node.vx *= VELOCITY_DECAY;
      node.vy *= VELOCITY_DECAY;
      node.x += node.vx;
      node.y += node.vy;
    }

    this.resolveCollisions(pinned, mask);

    // Centre by translating the centroid, the way d3-force does. Pulling every
    // node toward the middle with a spring instead — the obvious approach —
    // compresses the whole layout into a disc, because the inward force grows
    // with distance while repulsion falls off as 1/d².
    if (pinned === null) this.recentre(cx, cy, mask);

    return true;
  }

  private recentre(cx: number, cy: number, mask?: Uint8Array): void {
    const nodes = this.nodes;
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (mask !== undefined && mask[i] === 0) continue;
      sx += nodes[i].x;
      sy += nodes[i].y;
      count++;
    }
    if (count === 0) return;
    const dx = cx - sx / count;
    const dy = cy - sy / count;
    for (const node of nodes) {
      node.x += dx;
      node.y += dy;
    }
  }

  // ── Quadtree ────────────────────────────────────────────────────────────

  private buildQuadtree(mask?: Uint8Array): Quad | null {
    const nodes = this.nodes;
    if (nodes.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let any = false;
    for (let i = 0; i < nodes.length; i++) {
      if (mask !== undefined && mask[i] === 0) continue;
      const node = nodes[i];
      any = true;
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x > maxX) maxX = node.x;
      if (node.y > maxY) maxY = node.y;
    }
    if (!any) return null;

    const half = Math.max(maxX - minX, maxY - minY, 1) / 2 + 1;
    const root: Quad = {
      x0: minX - 1,
      y0: minY - 1,
      half,
      mass: 0,
      cx: 0,
      cy: 0,
      body: null,
      kids: null,
    };

    for (let i = 0; i < nodes.length; i++) {
      if (mask !== undefined && mask[i] === 0) continue;
      this.insert(root, nodes[i], 0);
    }
    this.summarize(root);
    return root;
  }

  private insert(quad: Quad, node: SimNode, depth: number): void {
    // Coincident or near-coincident points would subdivide forever.
    if (depth >= MAX_DEPTH) {
      quad.mass += node.r;
      quad.cx += node.x * node.r;
      quad.cy += node.y * node.r;
      return;
    }

    if (!quad.kids && !quad.body) {
      quad.body = node;
      return;
    }

    if (!quad.kids) {
      const existing = quad.body!;
      quad.body = null;
      quad.kids = [null, null, null, null];
      this.placeInChild(quad, existing, depth);
    }

    this.placeInChild(quad, node, depth);
  }

  private placeInChild(quad: Quad, node: SimNode, depth: number): void {
    const half = quad.half / 2;
    const east = node.x >= quad.x0 + quad.half ? 1 : 0;
    const south = node.y >= quad.y0 + quad.half ? 1 : 0;
    const slot = south * 2 + east;

    let child = quad.kids![slot];
    if (!child) {
      child = {
        x0: quad.x0 + east * quad.half,
        y0: quad.y0 + south * quad.half,
        half,
        mass: 0,
        cx: 0,
        cy: 0,
        body: null,
        kids: null,
      };
      quad.kids![slot] = child;
    }
    this.insert(child, node, depth + 1);
  }

  /** Post-order pass computing each cell's mass and center of mass. */
  private summarize(quad: Quad): void {
    if (quad.body) {
      quad.mass = quad.body.r;
      quad.cx = quad.body.x;
      quad.cy = quad.body.y;
      return;
    }

    let mass = quad.mass;
    let cx = quad.cx;
    let cy = quad.cy;

    if (quad.kids) {
      for (const kid of quad.kids) {
        if (!kid) continue;
        this.summarize(kid);
        mass += kid.mass;
        cx += kid.cx * kid.mass;
        cy += kid.cy * kid.mass;
      }
    }

    quad.mass = mass;
    quad.cx = mass > 0 ? cx / mass : quad.x0 + quad.half;
    quad.cy = mass > 0 ? cy / mass : quad.y0 + quad.half;
  }

  private repel(quad: Quad, node: SimNode, alpha: number): void {
    if (quad.mass === 0) return;

    let dx = quad.cx - node.x;
    let dy = quad.cy - node.y;
    let distSq = dx * dx + dy * dy;

    if (distSq < 1e-6) {
      // Jitter deterministically to break perfect overlap.
      dx = 1e-3;
      dy = 1e-3;
      distSq = 2e-6;
    }

    const width = quad.half * 2;

    // Far enough away that the whole cell can act as a single body.
    if (quad.body || (width * width) / distSq < THETA * THETA) {
      if (quad.body === node) return;
      const force = (this.charge * quad.mass * alpha) / distSq;
      const dist = Math.sqrt(distSq);
      node.vx += (dx / dist) * force;
      node.vy += (dy / dist) * force;
      return;
    }

    if (quad.kids) {
      for (const kid of quad.kids) {
        if (kid) this.repel(kid, node, alpha);
      }
    }
  }

  // ── Collision ───────────────────────────────────────────────────────────

  /**
   * Position-based overlap resolution on a uniform spatial hash. Labels are
   * unreadable when discs overlap, and the spring layer alone won't prevent it.
   */
  private resolveCollisions(pinned: number | null, mask?: Uint8Array): void {
    const nodes = this.nodes;
    let maxR = 0;
    for (const node of nodes) if (node.r > maxR) maxR = node.r;

    const cell = maxR * 2 + 6;
    const buckets = new Map<number, number[]>();
    const key = (cx: number, cy: number) => cx * 73856093 + cy * 19349663;

    for (let i = 0; i < nodes.length; i++) {
      if (mask !== undefined && mask[i] === 0) continue;
      const cx = Math.floor(nodes[i].x / cell);
      const cy = Math.floor(nodes[i].y / cell);
      const k = key(cx, cy);
      const bucket = buckets.get(k);
      if (bucket) bucket.push(i);
      else buckets.set(k, [i]);
    }

    for (let i = 0; i < nodes.length; i++) {
      if (mask !== undefined && mask[i] === 0) continue;
      const a = nodes[i];
      const cx = Math.floor(a.x / cell);
      const cy = Math.floor(a.y / cell);

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = buckets.get(key(cx + ox, cy + oy));
          if (!bucket) continue;

          for (const j of bucket) {
            if (j <= i) continue;
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const minDist = a.r + b.r + 4;
            const distSq = dx * dx + dy * dy;
            if (distSq >= minDist * minDist || distSq === 0) continue;

            const dist = Math.sqrt(distSq);
            const push = ((minDist - dist) / dist) * 0.5;
            const sx = dx * push;
            const sy = dy * push;
            if (i !== pinned) {
              a.x -= sx;
              a.y -= sy;
            }
            if (j !== pinned) {
              b.x += sx;
              b.y += sy;
            }
          }
        }
      }
    }
  }
}
