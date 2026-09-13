/* Owns the connectome simulation and turns it into two things the game needs:
   a live firing-rate vector, and the descending-neuron feature vector that the
   learned policy reads. */

import { fetchGz, decodeConnectome, decodeLabels } from '../engine/data.js';

const SAT = (x, k) => 1 - Math.exp(-Math.max(0, x) / k);

export class Brain {
  constructor() {
    this.ready = false;
    this.hz = null;
    this.winCount = null;
    this.lastRead = 0;
    this.totalSpikes = 0;
    this.onReady = null;
  }

  async load(onProgress) {
    const meta = JSON.parse(new TextDecoder().decode(await fetchGz('data/meta.json.gz')));
    this.meta = meta;
    const N = meta.n_neurons, E = meta.n_edges;
    onProgress?.('annotations', 0.10);
    this.labels = decodeLabels(await fetchGz('data/labels.bin.gz'), N);
    const sign = await fetchGz('data/sign.bin.gz');
    this.channels = await (await fetch('data/channels.json')).json();
    onProgress?.('connections', 0.18);
    const raw = await fetchGz('data/conn.bin.gz', f => onProgress?.('connections', 0.18 + f * 0.64));
    onProgress?.('rebuild', 0.86);
    await new Promise(r => setTimeout(r, 0));
    const conn = decodeConnectome(raw, N, E, sign);

    this.featNames = Object.keys(this.channels.features);
    this.featIdx = this.featNames.map(n => Int32Array.from(this.channels.features[n]));
    this.hz = new Float32Array(N);
    this.winCount = new Float32Array(N);

    this.worker = new Worker('js/engine/sim.worker.js');
    this.worker.onmessage = e => this._msg(e.data);
    this.worker.postMessage({ cmd: 'init', N, indptr: conn.indptr, indices: conn.indices, weights: conn.weights },
      [conn.indptr.buffer, conn.indices.buffer, conn.weights.buffer]);
    onProgress?.('renderer', 0.96);
  }

  _msg(m) {
    if (m.type === 'ready') {
      this.ready = true;
      this.worker.postMessage({ cmd: 'speed', value: 10 });
      this.worker.postMessage({ cmd: 'run', on: true });
      this.onReady?.();
      return;
    }
    if (m.type === 'frame') {
      const sp = m.spikes;
      for (let i = 0; i < sp.length; i++) this.winCount[sp[i]]++;
      this.t = m.t; this.nActive = m.nActive; this.totalSpikes = m.totalSpikes;
    }
  }

  /* call a few times a second; converts the spike window into Hz */
  tick(now) {
    if (!this.ready) return;
    const dt = this.lastRead ? Math.min(Math.max((now - this.lastRead) / 1000, 0.05), 1) : 0.2;
    this.lastRead = now;
    const hz = this.hz, wc = this.winCount;
    for (let i = 0; i < hz.length; i++) { hz[i] += ((wc[i] / dt) - hz[i]) * 0.5; wc[i] = 0; }
  }

  /* drive a set of neurons; passing an empty list lets her fall quiet again */
  stimulate(idx) {
    if (!this.ready) return;
    this.worker.postMessage({ cmd: 'stim', idx: Int32Array.from(idx || []), reset: false });
  }

  /* Evoked response: what the cue ADDED, not the absolute level.

     Her brain never falls silent — activity from earlier interactions keeps a
     large background going, and against that a cue is a small increment. Measured
     live, two different cues sat at cosine 0.85 when compared raw and around 0.01
     once the pre-cue baseline is subtracted. This is the same reason physiology
     reports evoked responses rather than raw rates. */
  evoked(baseline) {
    const x = this.features();
    if (!baseline) return x;
    let peak = 1e-6;
    for (let i = 0; i < x.length; i++) {
      x[i] = Math.max(0, x[i] - baseline[i]);
      if (x[i] > peak) peak = x[i];
    }
    // normalise so a faint cue and a loud one are compared on shape, not volume
    if (peak > 0.02) for (let i = 0; i < x.length; i++) x[i] /= peak;
    else x.fill(0);
    return x;
  }

  /* what the learned policy sees */
  features() {
    const x = new Float32Array(this.featIdx.length);
    for (let f = 0; f < this.featIdx.length; f++) {
      const ids = this.featIdx[f];
      let s = 0;
      for (let i = 0; i < ids.length; i++) s += this.hz[ids[i]];
      x[f] = SAT(s / ids.length, 40);
    }
    return x;
  }

  /* mean rate over one of the named descending channels */
  channel(name, side) {
    const c = this.channels.channels[name];
    if (!c) return 0;
    const list = side ? c[side] : c.all;
    if (!list || !list.length) return 0;
    let s = 0;
    for (let i = 0; i < list.length; i++) s += this.hz[list[i]];
    return s / list.length;
  }

  /* indices of every neuron whose annotated cell type matches */
  byType(names) {
    const d = this.meta.dicts, L = this.labels;
    const want = new Set(names.map(n => d.cell_type.indexOf(n)).filter(i => i >= 0));
    const pre = names.filter(n => n.endsWith('*')).map(n => n.slice(0, -1));
    if (pre.length) d.cell_type.forEach((nm, i) => { if (pre.some(p => nm.startsWith(p))) want.add(i); });
    const out = [];
    for (let i = 0; i < L.cellType.length; i++) if (want.has(L.cellType[i])) out.push(i);
    return out;
  }
  byClass(names) {
    const d = this.meta.dicts, L = this.labels;
    const want = new Set(names.map(n => d.cell_class.indexOf(n)).filter(i => i >= 0));
    const out = [];
    for (let i = 0; i < L.cellClass.length; i++) if (want.has(L.cellClass[i])) out.push(i);
    return out;
  }
}
