/* The arena: walls, a food source, and the odour that spreads from it.

   Geometry is a grid of cells with walls on cell edges, carved by randomised
   depth-first search and then loosened — a perfect maze has exactly one route to
   the food, which makes a gradient-following agent look better than it is. Extra
   openings give her real choices. */

export const CELL = 1.0;          // world units per cell

export class Maze {
  constructor(cols = 9, rows = 9, seed = 1) {
    this.cols = cols; this.rows = rows;
    this.rng = mulberry(seed);
    this.carve();
    this.field = new Float32Array(cols * rows);
    this.scratch = new Float32Array(cols * rows);
  }

  idx(x, y) { return y * this.cols + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }

  carve() {
    const { cols, rows } = this;
    // wall[i] bitmask: 1 = north, 2 = east, 4 = south, 8 = west
    this.wall = new Uint8Array(cols * rows).fill(0b1111);
    const seen = new Uint8Array(cols * rows);
    const stack = [[0, 0]];
    seen[0] = 1;
    const DIRS = [[0, -1, 1, 4], [1, 0, 2, 8], [0, 1, 4, 1], [-1, 0, 8, 2]];
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const opts = [];
      for (const [dx, dy, bit, opp] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (this.inside(nx, ny) && !seen[this.idx(nx, ny)]) opts.push([nx, ny, bit, opp]);
      }
      if (!opts.length) { stack.pop(); continue; }
      const [nx, ny, bit, opp] = opts[(this.rng() * opts.length) | 0];
      this.wall[this.idx(x, y)] &= ~bit;
      this.wall[this.idx(nx, ny)] &= ~opp;
      seen[this.idx(nx, ny)] = 1;
      stack.push([nx, ny]);
    }
    // loosen: knock out extra walls so there is more than one way through
    const extra = Math.floor(cols * rows * 0.18);
    for (let k = 0; k < extra; k++) {
      const x = (this.rng() * cols) | 0, y = (this.rng() * rows) | 0;
      const [dx, dy, bit, opp] = DIRS[(this.rng() * 4) | 0];
      const nx = x + dx, ny = y + dy;
      if (!this.inside(nx, ny)) continue;
      this.wall[this.idx(x, y)] &= ~bit;
      this.wall[this.idx(nx, ny)] &= ~opp;
    }
    this.food = [cols - 1, rows - 1];
    this.start = [0, 0];
  }

  open(x, y, dir) {          // dir: 0 N, 1 E, 2 S, 3 W
    if (!this.inside(x, y)) return false;
    return (this.wall[this.idx(x, y)] & (1 << dir)) === 0;
  }

  /* Odour concentration through the corridors.

     An earlier version relaxed a diffusion equation, but a per-iteration decay
     applied to every cell collapsed the whole field (0.987^900 is 7e-6) and the
     start cell read exactly zero. This walks the maze from the food instead —
     breadth-first, so it goes round corners and into dead ends exactly as a plume
     would — and falls off exponentially with the distance actually travelled.
     Same shape, no numerical cliff, and monotonic so there is a gradient to climb. */
  diffuse(lambda = 4.4) {
    const { cols, rows, field } = this;
    const dist = new Float32Array(cols * rows).fill(Infinity);
    const fi = this.idx(this.food[0], this.food[1]);
    dist[fi] = 0;
    let q = [this.food.slice()];
    const DIRS = [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]];
    while (q.length) {
      const next = [];
      for (const [x, y] of q) {
        const d = dist[this.idx(x, y)];
        for (const [dx, dy, dir] of DIRS) {
          if (!this.open(x, y, dir)) continue;
          const nx = x + dx, ny = y + dy;
          if (!this.inside(nx, ny)) continue;
          const ni = this.idx(nx, ny);
          if (dist[ni] <= d + 1) continue;
          dist[ni] = d + 1;
          next.push([nx, ny]);
        }
      }
      q = next;
    }
    this.dist = dist;
    let far = 0;
    for (let i = 0; i < field.length; i++) {
      field[i] = isFinite(dist[i]) ? Math.exp(-dist[i] / lambda) : 0;
      if (isFinite(dist[i]) && dist[i] > far) far = dist[i];
    }
    this.farthest = far;
    return field;
  }

  /* bilinear sample of the odour field at a world position */
  sample(wx, wy) {
    const gx = wx / CELL - 0.5, gy = wy / CELL - 0.5;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const at = (x, y) => this.inside(x, y) ? this.field[this.idx(x, y)] : 0;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy)
         + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  }

  /* how far a ray from (wx,wy) in `heading` gets before a wall, capped at `max` */
  rayWall(wx, wy, heading, max = 1.2) {
    const step = 0.06;
    const dx = Math.sin(heading) * step, dy = Math.cos(heading) * step;
    let x = wx, y = wy;
    for (let d = step; d < max; d += step) {
      const nx = x + dx, ny = y + dy;
      if (this.blocked(x, y, nx, ny)) return d;
      x = nx; y = ny;
    }
    return max;
  }

  /* is moving from a to b crossing a wall or leaving the arena? */
  blocked(ax, ay, bx, by) {
    const cx = Math.floor(ax / CELL), cy = Math.floor(ay / CELL);
    const nx = Math.floor(bx / CELL), ny = Math.floor(by / CELL);
    if (!this.inside(nx, ny)) return true;
    if (cx === nx && cy === ny) return false;
    if (!this.inside(cx, cy)) return true;
    if (nx === cx + 1) return !this.open(cx, cy, 1);
    if (nx === cx - 1) return !this.open(cx, cy, 3);
    if (ny === cy + 1) return !this.open(cx, cy, 2);
    if (ny === cy - 1) return !this.open(cx, cy, 0);
    return true;                       // diagonal: treat as blocked
  }

  worldOf(cx, cy) { return [(cx + 0.5) * CELL, (cy + 0.5) * CELL]; }
  get foodWorld() { return this.worldOf(this.food[0], this.food[1]); }
  get startWorld() { return this.worldOf(this.start[0], this.start[1]); }
}

function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
