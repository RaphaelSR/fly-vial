/* Her brain, drawn where it actually is.

   These are the 18,267 neurons of the subcircuit at their real FlyWire
   coordinates — the same cells the simulation is stepping, not a diagram. Resting
   cells are dim and draw the anatomy; a cell that just fired burns toward white.
   Colour is the neurotransmitter each one releases, so a wash of amber spreading
   is excitation and the blue and violet cells are the brakes. */

import * as THREE from 'three';
import { fetchGz, decodePositions } from '../engine/data.js';

const NT_COLOUR = {
  acetylcholine: [0.96, 0.68, 0.26], gaba: [0.28, 0.58, 0.88],
  glutamate: [0.64, 0.45, 0.87], dopamine: [0.35, 0.78, 0.55],
  serotonin: [0.90, 0.45, 0.65], octopamine: [0.30, 0.78, 0.80],
  unknown: [0.45, 0.52, 0.55],
};

const VS = `
attribute float aAct;
attribute vec3 aCol;
uniform float uSize;
uniform float uBase;
varying vec3 vCol;
varying float vAct;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (0.72 + aAct * 2.6) / -mv.z;
  // only the hardest-firing cells wash out to white, or the transmitter
  // colours stop reading and the cloud turns into a grey blob
  vec3 hot = mix(aCol, vec3(1.0, 0.96, 0.88), smoothstep(0.45, 1.0, aAct) * 0.8);
  vCol = hot * (uBase + aAct * 1.9);
  vAct = aAct;
  gl_Position = projectionMatrix * mv;
}`;

const FS = `
varying vec3 vCol;
varying float vAct;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float core = exp(-r * 7.0);
  float halo = exp(-r * 2.2) * vAct * 0.8;
  gl_FragColor = vec4(vCol * (core + halo), 1.0);
}`;

export class BrainView {
  constructor(canvas, brain, theme = 'dark') {
    this.canvas = canvas;
    this.brain = brain;
    this.theme = theme;
    this.ready = false;
    this.spin = 0;
    this.act = null;
  }

  async load() {
    const meta = this.brain.meta;
    const N = meta.n_neurons;
    const raw = await fetchGz('data/pos.u16.bin.gz');
    const { pos, radius } = decodePositions(raw, N, meta.bbox_lo, meta.span);
    this.radius = radius;

    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, radius * 0.02, radius * 40);

    const colours = new Float32Array(N * 3);
    const ntNames = meta.dicts.top_nt, nt = this.brain.labels.nt;
    for (let i = 0; i < N; i++) {
      const c = NT_COLOUR[ntNames[nt[i]]] || NT_COLOUR.unknown;
      colours[i * 3] = c[0]; colours[i * 3 + 1] = c[1]; colours[i * 3 + 2] = c[2];
    }
    this.act = new Float32Array(N);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aCol', new THREE.BufferAttribute(colours, 3));
    this.actAttr = new THREE.BufferAttribute(this.act, 1);
    this.actAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aAct', this.actAttr);

    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 40 }, uBase: { value: 0.22 } },
    });
    this.scene.add(new THREE.Points(geo, this.mat));
    this.setTheme(this.theme);
    this.ready = true;
  }

  setTheme(theme) {
    this.theme = theme;
    // on a light ground the additive cloud needs to be dimmer or it washes out
    if (this.mat) this.mat.uniforms.uBase.value = theme === 'light' ? 0.13 : 0.22;
  }

  /* fold this frame's firing into a decaying glow */
  update(dt) {
    if (!this.ready) return;
    const hz = this.brain.hz, act = this.act;
    const decay = Math.pow(0.05, dt);
    for (let i = 0; i < act.length; i++) {
      const v = hz[i] > 1 ? Math.min(1, hz[i] / 120) : 0;
      const a = act[i] * decay;
      act[i] = v > a ? v : a;
    }
    this.actAttr.needsUpdate = true;
    this.spin += dt * 0.22;
  }

  render() {
    if (!this.ready) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    if (this._w !== w || this._h !== h) {
      this._w = w; this._h = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    const d = this.radius * 2.6;
    this.camera.position.set(Math.sin(this.spin) * d, -this.radius * 0.25, Math.cos(this.spin) * d);
    this.camera.up.set(0, -1, 0);           // FlyWire coordinates run y-down
    this.camera.lookAt(0, 0, 0);
    this.mat.uniforms.uSize.value = h * 0.085;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
