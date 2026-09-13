/* Operant conditioning.

   The connectome does the sensing: a cue drives real sensory neurons and leaves a
   pattern in the descending neurons. This layer is the part that learns — a linear
   softmax policy over that pattern, updated by REINFORCE with a running baseline.
   It is reinforcement learning, not synaptic plasticity: the connectome has no
   plasticity to offer. Real flies can be operantly conditioned, so the behaviour
   is honest even though the mechanism here is ours.

   Trained sizes are tiny (5 actions x 58 features), so it fits in localStorage and
   learns in roughly the twenty trials a real fly needs. */

export const ACTIONS = ['proboscis', 'walk', 'turn', 'jump', 'freeze'];

export class Policy {
  constructor(nFeat, saved) {
    this.D = nFeat;
    this.K = ACTIONS.length;
    this.W = new Float32Array(this.K * this.D);
    this.b = new Float32Array(this.K);
    this.baseline = 0;
    this.trials = 0;
    this.history = [];
    if (saved) this.restore(saved);
  }

  logits(x) {
    const z = new Float32Array(this.K);
    for (let k = 0; k < this.K; k++) {
      let s = this.b[k], off = k * this.D;
      for (let d = 0; d < this.D; d++) s += this.W[off + d] * x[d];
      z[k] = s;
    }
    return z;
  }

  probs(x, temperature = 1) {
    const z = this.logits(x);
    let max = -Infinity;
    for (let k = 0; k < this.K; k++) { z[k] /= temperature; if (z[k] > max) max = z[k]; }
    let sum = 0;
    for (let k = 0; k < this.K; k++) { z[k] = Math.exp(z[k] - max); sum += z[k]; }
    for (let k = 0; k < this.K; k++) z[k] /= sum;
    return z;
  }

  /* sample an action; exploration cools as she gains experience */
  act(x) {
    const temp = Math.max(0.6, 1.7 - this.trials * 0.02);
    const p = this.probs(x, temp);
    let r = Math.random(), k = 0;
    while (k < this.K - 1 && (r -= p[k]) > 0) k++;
    return { action: k, probs: p };
  }

  /* reward in 0..1; 0 means "no sugar", which is itself information */
  reinforce(x, action, reward, lr = 0.55) {
    const p = this.probs(x);
    const adv = reward - this.baseline;
    this.baseline += 0.12 * (reward - this.baseline);
    for (let k = 0; k < this.K; k++) {
      const g = ((k === action ? 1 : 0) - p[k]) * adv;
      this.b[k] += lr * g * 0.4;
      const off = k * this.D;
      for (let d = 0; d < this.D; d++) this.W[off + d] += lr * g * x[d];
    }
    this.trials++;
    this.history.push({ a: action, r: reward });
    if (this.history.length > 120) this.history.shift();
  }

  /* how reliably she picks `action` for this cue pattern right now */
  confidence(x, action) { return this.probs(x)[action]; }

  serialise() {
    return {
      W: Array.from(this.W, v => Math.round(v * 1e4) / 1e4),
      b: Array.from(this.b, v => Math.round(v * 1e4) / 1e4),
      baseline: this.baseline, trials: this.trials, history: this.history.slice(-40),
    };
  }
  restore(s) {
    if (!s || !s.W || s.W.length !== this.W.length) return;
    this.W.set(s.W); this.b.set(s.b);
    this.baseline = s.baseline || 0;
    this.trials = s.trials || 0;
    this.history = s.history || [];
  }
  forget() {
    this.W.fill(0); this.b.fill(0);
    this.baseline = 0; this.trials = 0; this.history = [];
  }
}
