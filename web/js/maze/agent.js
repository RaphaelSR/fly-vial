/* Sensing, deciding and learning.

   What goes INTO the connectome is odour only: the subcircuit we ship is the
   three-synapse path from the odour receptors to the command neurons, so odour is
   the honest input. Her antennae sit apart on her head, so each samples the plume
   at a different point and the two ORN populations are driven at different rates.
   That bilateral difference is how a real fly climbs a gradient.

   What comes OUT is the descending readout. A linear softmax policy over it picks
   a step, and REINFORCE with a discounted return and a running baseline trains it.
   The connectome has no plasticity; only this readout learns, and the UI says so. */

export const ACTIONS = ['forward', 'left', 'right'];
const ANTENNA = 0.16;        // half-separation of the antennae, in cell units
const ANT_FWD = 0.16;        // how far ahead of her centre they sit
export const CONTRAST = 28;  // bilateral contrast gain — see Senses.drive

/* Sniffing, not staring.

   Driving the receptors continuously destroys the very thing we need: within about
   80 ms the recurrent network saturates and the descending readout stops reflecting
   the input — two opposite odour patterns measured at cosine 0.9995, which is no
   information at all. A brief pulse read during its transient keeps it: 20 ms of
   drive, sampled 40 ms after onset, against the pattern from just before, gives
   cosine 0.29. So she samples the plume in bursts, which is also closer to what a
   walking fly does than a continuous stare. */
const SNIFF = { width: 20, readAt: 40, gap: 300 };   // biological ms

export class Senses {
  constructor(brain, maze) {
    this.brain = brain; this.maze = maze;
    this.orn = brain.byType(['ORN_DM1', 'ORN_DM2']);
    const side = brain.meta.dicts.side, L = brain.labels.side;
    const l = side.indexOf('left'), r = side.indexOf('right');
    this.left = this.orn.filter(i => L[i] === l);
    this.right = this.orn.filter(i => L[i] === r);
    if (!this.left.length || !this.right.length) {
      const h = this.orn.length >> 1;
      this.left = this.orn.slice(0, h); this.right = this.orn.slice(h);
    }
    this.idx = [...this.left, ...this.right];
    this.rates = new Float32Array(this.idx.length);
    this.phase = 'gap';
    this.mark = 0;
    this.evoked = new Float32Array(brain.featIdx.length);
    this.baseline = null;
    this.last = { left: 0, right: 0, hzLeft: 0, hzRight: 0 };
  }

  /* Run the sniff cycle against biological time. Returns true on the tick where a
     fresh evoked reading became available. */
  update(x, y, heading, maxHz = 60) {
    const t = this.brain.t;
    if (this.phase === 'gap') {
      if (t - this.mark < SNIFF.gap) return false;
      this.baseline = this.brain.features().slice();
      this.applyDrive(x, y, heading, maxHz);
      this.phase = 'pulse';
      this.mark = t;
      return false;
    }
    if (this.phase === 'pulse') {
      if (t - this.mark < SNIFF.width) return false;
      this.brain.stimulate([]);
      this.phase = 'read';
      return false;
    }
    if (t - this.mark < SNIFF.readAt) return false;
    const f = this.brain.features();
    let peak = 1e-6;
    for (let i = 0; i < f.length; i++) {
      this.evoked[i] = Math.max(0, f[i] - this.baseline[i]);
      if (this.evoked[i] > peak) peak = this.evoked[i];
    }
    if (peak > 0.01) for (let i = 0; i < f.length; i++) this.evoked[i] /= peak;
    else this.evoked.fill(0);
    this.phase = 'gap';
    this.mark = t;
    return true;
  }

  applyDrive(x, y, heading, maxHz) {
    const cx = Math.sin(heading) * ANT_FWD, cy = Math.cos(heading) * ANT_FWD;
    const px = Math.cos(heading) * ANTENNA, py = -Math.sin(heading) * ANTENNA;
    const cl = this.maze.sample(x + cx - px, y + cy - py);
    const cr = this.maze.sample(x + cx + px, y + cy + py);
    const FLOOR = 1e-5, L = Math.log(FLOOR);
    const enc = c => c <= FLOOR ? 0
      : maxHz * Math.max(0, Math.min(1, (Math.log(c) - L) / -L));
    let hl = enc(cl), hr = enc(cr);
    const mean = (hl + hr) / 2, d = (hl - hr) / 2;
    hl = Math.max(0, Math.min(maxHz, mean + d * CONTRAST));
    hr = Math.max(0, Math.min(maxHz, mean - d * CONTRAST));
    for (let i = 0; i < this.left.length; i++) this.rates[i] = hl;
    for (let i = 0; i < this.right.length; i++) this.rates[this.left.length + i] = hr;
    this.brain.stimulate(this.idx, this.rates);
    this.last = { left: cl, right: cr, hzLeft: hl, hzRight: hr };
    return this.last;
  }

  clear() { this.brain.stimulate([]); this.phase = 'gap'; this.mark = this.brain.t; }
}

export class Policy {
  constructor(D, K = ACTIONS.length) {
    this.D = D; this.K = K;
    this.W = new Float32Array(K * D);
    this.b = new Float32Array(K);
    this.baseline = 0;
    this.episodes = 0;
  }

  probs(x, temp = 1) {
    const z = new Float32Array(this.K);
    let max = -Infinity;
    for (let k = 0; k < this.K; k++) {
      let s = this.b[k]; const off = k * this.D;
      for (let d = 0; d < this.D; d++) s += this.W[off + d] * x[d];
      z[k] = s / temp; if (z[k] > max) max = z[k];
    }
    let sum = 0;
    for (let k = 0; k < this.K; k++) { z[k] = Math.exp(z[k] - max); sum += z[k]; }
    for (let k = 0; k < this.K; k++) z[k] /= sum;
    return z;
  }

  act(x, explore = 1) {
    const p = this.probs(x, explore);
    let r = Math.random(), k = 0;
    while (k < this.K - 1 && (r -= p[k]) > 0) k++;
    return { action: k, probs: p };
  }

  /* one episode: steps is [{x, action, reward}], newest last */
  learn(steps, gamma = 0.94, lr = 0.22) {
    if (!steps.length) return 0;
    let G = 0;
    const returns = new Float64Array(steps.length);
    for (let t = steps.length - 1; t >= 0; t--) { G = steps[t].reward + gamma * G; returns[t] = G; }
    let mean = 0;
    for (let t = 0; t < steps.length; t++) mean += returns[t];
    mean /= steps.length;
    let sd = 0;
    for (let t = 0; t < steps.length; t++) sd += (returns[t] - mean) ** 2;
    sd = Math.sqrt(sd / steps.length) || 1;
    for (let t = 0; t < steps.length; t++) {
      const s = steps[t];
      const adv = (returns[t] - mean) / sd;
      const p = this.probs(s.x);
      for (let k = 0; k < this.K; k++) {
        const g = ((k === s.action ? 1 : 0) - p[k]) * adv;
        this.b[k] += lr * g * 0.25;
        const off = k * this.D;
        for (let d = 0; d < this.D; d++) this.W[off + d] += lr * g * s.x[d];
      }
    }
    this.episodes++;
    return mean;
  }

  serialise() {
    return { W: Array.from(this.W, v => Math.round(v * 1e4) / 1e4),
             b: Array.from(this.b, v => Math.round(v * 1e4) / 1e4), episodes: this.episodes };
  }
  restore(s) {
    if (!s || !s.W || s.W.length !== this.W.length) return false;
    this.W.set(s.W); this.b.set(s.b); this.episodes = s.episodes || 0; return true;
  }
  forget() { this.W.fill(0); this.b.fill(0); this.episodes = 0; }
}

/* The body between decisions: she walks, and slides along walls rather than
   sticking to them. Leg mechanoreceptors are not in the olfactory subcircuit, so
   wall contact is a body reflex here, not something her brain is told about. */
export class Body {
  constructor(maze) {
    this.maze = maze;
    this.R = 0.13;            // her body radius, so she cannot clip a wall corner
    this.reset();
  }

  reset() {
    const [x, y] = this.maze.startWorld;
    this.x = x; this.y = y;
    this.heading = Math.PI / 2;
    this.turnVel = 0;
    this.speed = 0;
    this.trail = [[x, y]];
    this.bumps = 0;
  }

  /* Turning carries momentum and speed eases in, so a change of action reads as a
     manoeuvre rather than a teleport — and the gait has a real speed to run on. */
  step(action, dt, cruise = 0.72, turnAccel = 11) {
    const want = action === 1 ? -1 : action === 2 ? 1 : 0;
    this.turnVel += (want * 2.4 - this.turnVel) * Math.min(1, dt * turnAccel);
    this.heading += this.turnVel * dt;
    const target = action === 0 ? cruise : cruise * 0.5;
    this.speed += (target - this.speed) * Math.min(1, dt * 6);

    const dx = Math.sin(this.heading) * this.speed * dt;
    const dy = Math.cos(this.heading) * this.speed * dt;
    const before = this.bumps;
    this.x = this.slide(this.x, this.y, dx, true);
    this.y = this.slide(this.x, this.y, dy, false);
    if (this.bumps > before) {
      // Sliding along a wall must not cost speed: the penalty used to apply on
      // every frame of contact, so she ground to a halt against the first wall and
      // no longer had the speed to turn out of it. Instead, contact nudges her
      // away — a leg-mechanoreceptor reflex, which is not in this subcircuit and
      // is therefore body-level here, like the rest of the wall handling.
      this.contact = Math.min(1, (this.contact || 0) + 0.4);
      this.turnVel += (this.avoidSign(dx, dy)) * 3.4 * dt * 60 * 0.016;
    } else {
      this.contact = Math.max(0, (this.contact || 0) - dt * 2);
    }

    const last = this.trail[this.trail.length - 1];
    if ((this.x - last[0]) ** 2 + (this.y - last[1]) ** 2 > 0.012) {
      this.trail.push([this.x, this.y]);
      if (this.trail.length > 420) this.trail.shift();
    }
  }

  /* which way to peel off a wall: toward whichever side has more room ahead */
  avoidSign(dx, dy) {
    const m = this.maze, probe = 0.42;
    const h = this.heading;
    const l = m.rayWall(this.x, this.y, h - 0.8, probe);
    const r = m.rayWall(this.x, this.y, h + 0.8, probe);
    if (Math.abs(l - r) < 0.02) return this.x + this.y > 0 ? 1 : -1;
    return r > l ? 1 : -1;
  }

  /* Move one axis at a time and clamp against that axis's walls.

     Resolving both axes together made every near-corner move look diagonal to the
     wall test, which rejected the whole step and pinned her to the wall — 333
     bumps in half a minute of walking. Axis separation is the standard fix:
     blocked on one axis, she still slides along the other. */
  slide(x, y, d, isX) {
    const m = this.maze, C = 1.0, R = this.R;
    const v = (isX ? x : y) + d;
    const gx = Math.floor(x / C), gy = Math.floor(y / C);
    if (!m.inside(gx, gy)) return v;
    const lo = (isX ? gx : gy) * C, hi = lo + C;
    const dirLo = isX ? 3 : 0, dirHi = isX ? 1 : 2;
    if (d < 0 && !m.open(gx, gy, dirLo) && v - lo < R) { this.bumps++; return lo + R; }
    if (d > 0 && !m.open(gx, gy, dirHi) && hi - v < R) { this.bumps++; return hi - R; }
    const ng = Math.floor(v / C);
    if (isX ? !m.inside(ng, gy) : !m.inside(gx, ng)) { this.bumps++; return isX ? x : y; }
    return v;
  }

  distanceToFood() {
    const [fx, fy] = this.maze.foodWorld;
    return Math.hypot(this.x - fx, this.y - fy);
  }
}
