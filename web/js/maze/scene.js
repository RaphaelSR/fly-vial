/* The look: a milled acrylic arena on a backlit stage, in a dark room.

   Reference is a real Drosophila behavioural rig — a clear plate lit from
   underneath by a light table — and the odour is drawn the way wind-tunnel plumes
   are, as drifting haze. Everything is emissive plus bloom rather than lit by
   lamps, which is what keeps it readable at this scale and cheap at 60 fps. */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CELL } from './maze.js';

const AMBER = 0xF2A93B, PALE = 0xCFE7EC, DEEP = 0x0A1013;

/* The arena is lit the way a real behavioural rig is — a plate on a light table —
   so the light theme is not an inversion of the dark one: the room comes up, the
   plate stays the brightest thing, and the acrylic reads by its edges instead of
   by its glow. */
export const PALETTES = {
  dark: {
    bg: 0x0A1013, fogNear: 9, fogFar: 26,
    base: 0x0C1417, rim: 0x6FA8BA, floor: 0x1B2E35, floorEmis: 0x0E1E24,
    glass: 0xA8D2DE, glassOpacity: 0.68, transmission: 0.72, edge: 0xBFE6F2,
    ambient: 0x8FB8C6, ambientI: 0.55, keyI: 0.85,
    exposure: 1.05, bloom: 0.42, bloomThreshold: 0.82,
    trail: [0.98, 0.76, 0.42], plumeA: 1.0, halo: 0.22,
  },
  light: {
    bg: 0xDCE6E9, fogNear: 14, fogFar: 40,
    base: 0xC6D4D9, rim: 0xFFFFFF, floor: 0xEFF4F6, floorEmis: 0x000000,
    glass: 0x5E8794, glassOpacity: 0.30, transmission: 0.88, edge: 0x35606E,
    ambient: 0xFFFFFF, ambientI: 1.15, keyI: 1.5,
    exposure: 1.0, bloom: 0.16, bloomThreshold: 0.96,
    trail: [0.80, 0.42, 0.06], plumeA: 2.1, halo: 0.30,
  },
};
const WALL_H = 0.42, WALL_T = 0.055;

export class Arena {
  constructor(canvas, theme = 'dark') {
    this.canvas = canvas;
    this.P = PALETTES[theme] || PALETTES.dark;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.P.exposure;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.P.bg);
    this.scene.fog = new THREE.Fog(this.P.bg, this.P.fogNear, this.P.fogFar);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.orbit = { yaw: -0.52, pitch: 0.92, dist: 15.0, shiftX: -1.4, target: new THREE.Vector3() };
    this._bindControls();

    this.scene.add(new THREE.AmbientLight(this.P.ambient, this.P.ambientI));
    const key = new THREE.DirectionalLight(0xEAF4F7, this.P.keyI);
    key.position.set(4, 9, 5);
    this.scene.add(key);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), this.P.bloom, 0.75, this.P.bloomThreshold);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.clock = new THREE.Clock();
  }

  _bindControls() {
    const c = this.canvas; let drag = false, lx = 0, ly = 0;
    c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); drag = true; lx = e.clientX; ly = e.clientY; });
    c.addEventListener('pointermove', e => {
      if (!drag) return;
      this.orbit.yaw -= (e.clientX - lx) * 0.006;
      this.orbit.pitch = Math.max(0.22, Math.min(1.45, this.orbit.pitch + (e.clientY - ly) * 0.005));
      lx = e.clientX; ly = e.clientY;
    });
    c.addEventListener('pointerup', () => drag = false);
    c.addEventListener('pointercancel', () => drag = false);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.orbit.dist = Math.max(5, Math.min(30, this.orbit.dist * Math.exp(e.deltaY * 0.0011)));
    }, { passive: false });
  }

  /* rebuild every piece of geometry for a new maze */
  build(maze) {
    this.maze = maze;
    this.root.clear();
    const W = maze.cols * CELL, H = maze.rows * CELL;
    this.centre = new THREE.Vector3(W / 2, 0, H / 2);
    this.orbit.target.copy(this.centre);
    // fit the plate in view rather than trusting a hand-picked distance
    const span = Math.max(W, H);
    this.orbit.dist = span * 1.95;

    // the backlit stage the plate sits on
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(W + 1.5, 0.22, H + 1.5),
      new THREE.MeshStandardMaterial({ color: this.P.base, roughness: 0.85, metalness: 0.1 }));
    base.position.set(W / 2, -0.12, H / 2);
    this.root.add(base);

    // a thin lit rim around the plate, not a slab of white under the whole thing
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.5, 4),
      new THREE.MeshBasicMaterial({ color: 0x9FD6E4 }));
    const rimShape = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.9, 0.02, H + 0.9),
      new THREE.MeshBasicMaterial({ color: this.P.rim }));
    rimShape.position.set(W / 2, 0.004, H / 2);
    this.root.add(rimShape);
    rim.visible = false;

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.05, H),
      new THREE.MeshStandardMaterial({ color: this.P.floor, roughness: 0.62, emissive: this.P.floorEmis, emissiveIntensity: 1 }));
    floor.position.set(W / 2, 0.028, H / 2);
    this.root.add(floor);

    // acrylic walls: one instanced mesh for the slabs, one for the glowing top edges
    const segs = this._wallSegments(maze);
    const glass = new THREE.MeshPhysicalMaterial({
      color: this.P.glass, transmission: this.P.transmission, thickness: 0.30, roughness: 0.14,
      metalness: 0, ior: 1.46, transparent: true, opacity: this.P.glassOpacity,
      clearcoat: 0.6, clearcoatRoughness: 0.25,
    });
    const slab = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), glass, segs.length);
    const edgeMat = new THREE.MeshBasicMaterial({ color: this.P.edge });
    const edge = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), edgeMat, segs.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    segs.forEach((s, i) => {
      m.compose(new THREE.Vector3(s.x, WALL_H / 2, s.z), q,
                new THREE.Vector3(s.w, WALL_H, s.d));
      slab.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(s.x, WALL_H + 0.004, s.z), q,
                new THREE.Vector3(s.w * 1.01, 0.012, s.d * 1.01));
      edge.setMatrixAt(i, m);
    });
    this.root.add(slab, edge);

    // the food: a drop of syrup that lights its corner
    const [fx, fz] = maze.foodWorld;
    this.food = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 26, 18),
      new THREE.MeshStandardMaterial({ color: AMBER, emissive: AMBER, emissiveIntensity: 3.2, roughness: 0.25 }));
    this.food.position.set(fx, 0.19, fz);
    this.root.add(this.food);
    const lamp = new THREE.PointLight(AMBER, 6, 5, 2);
    lamp.position.set(fx, 0.45, fz);
    this.root.add(lamp);

    this.plume = new Plume(maze, 900, this.P.plumeA);
    this.root.add(this.plume.points);
    this.trail = new Trail(420, this.P.trail);
    this.root.add(this.trail.line);
    this.fly = buildFly(this.root, 1.05);
    // a soft pool of light under her so she is findable anywhere in the maze
    this.halo = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 28),
      new THREE.MeshBasicMaterial({ color: 0xFFB347, transparent: true, opacity: 0.30,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.rotation.x = -Math.PI / 2;
    this.root.add(this.halo);
  }

  _wallSegments(maze) {
    const out = [];
    const push = (x, z, w, d) => out.push({ x, z, w, d });
    for (let y = 0; y < maze.rows; y++) for (let x = 0; x < maze.cols; x++) {
      const cx = (x + 0.5) * CELL, cz = (y + 0.5) * CELL;
      if (!maze.open(x, y, 0)) push(cx, cz - CELL / 2, CELL + WALL_T, WALL_T);
      if (!maze.open(x, y, 3)) push(cx - CELL / 2, cz, WALL_T, CELL + WALL_T);
      if (y === maze.rows - 1 && !maze.open(x, y, 2)) push(cx, cz + CELL / 2, CELL + WALL_T, WALL_T);
      if (x === maze.cols - 1 && !maze.open(x, y, 1)) push(cx + CELL / 2, cz, WALL_T, CELL + WALL_T);
    }
    return out;
  }

  update(body, dt, t) {
    this.plume.update(t);
    this.trail.set(body.trail);
    this.fly.place(body.x, body.y, body.heading, body.speed || 0, dt, t);
    this.halo.position.set(body.x, 0.062, body.y);
    this.halo.material.opacity = this.P.halo + 0.07 * Math.sin(t * 3.1);
    this.food.position.y = 0.19 + Math.sin(t * 1.6) * 0.012;
  }

  render() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (this.canvas.width !== w * this.renderer.getPixelRatio() || this._w !== w || this._h !== h) {
      this._w = w; this._h = h;
      this.renderer.setSize(w, h, false);
      this.composer.setSize(w, h);
      this.camera.aspect = w / Math.max(h, 1);
      this.camera.updateProjectionMatrix();
    }
    const o = this.orbit;
    this.camera.position.set(
      o.target.x + o.dist * Math.cos(o.pitch) * Math.sin(o.yaw),
      o.target.y + o.dist * Math.sin(o.pitch),
      o.target.z + o.dist * Math.cos(o.pitch) * Math.cos(o.yaw));
    this.camera.lookAt(o.target);
    // Nudge the view left so the right-hand panels do not cover the arena — but
    // only when those panels actually sit beside the scene. Below the breakpoint
    // they stack underneath and the arena should stay centred.
    const railed = this.canvas.clientWidth > 860;
    if (railed) {
      this.camera.setViewOffset(this.canvas.width, this.canvas.height,
        (o.shiftX || 0) * this.canvas.width / 26, 0, this.canvas.width, this.canvas.height);
    } else if (this._offset) {
      this.camera.clearViewOffset();
    }
    this._offset = railed;
    this.composer.render();
  }
}

/* Drifting haze, densest where the odour field is strongest. Billboarded points
   with a soft radial falloff, additively blended — a particle effect, not a fluid
   solve, because this has to leave the frame budget to the brain. */
class Plume {
  constructor(maze, count = 900, alphaScale = 1) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);
    let n = 0, guard = 0;
    while (n < count && guard++ < count * 60) {
      const x = Math.random() * maze.cols * CELL;
      const z = Math.random() * maze.rows * CELL;
      const c = maze.sample(x, z);
      if (Math.random() > Math.pow(c, 0.7)) continue;
      pos[n * 3] = x; pos[n * 3 + 1] = 0.06 + Math.random() * WALL_H * 0.95; pos[n * 3 + 2] = z;
      seed[n] = Math.random() * 100;
      size[n] = (0.34 + Math.random() * 0.46) * (0.55 + c);
      n++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, n * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed.subarray(0, n), 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size.subarray(0, n), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uAlpha: { value: alphaScale } },
      vertexShader: `
        attribute float aSeed; attribute float aSize;
        uniform float uTime; uniform float uScale; uniform float uAlpha;
        varying float vA; varying float vS;
        void main(){
          vec3 p = position;
          p.x += sin(uTime * 0.28 + aSeed) * 0.10;
          p.z += cos(uTime * 0.21 + aSeed * 1.7) * 0.10;
          p.y += sin(uTime * 0.35 + aSeed * 2.3) * 0.05;
          vS = aSeed;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aSize * uScale * 320.0 / -mv.z;
          vA = (0.10 + 0.07 * sin(uTime * 0.5 + aSeed)) * uAlpha;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA; varying float vS;
        void main(){
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d);
          if (r > 0.25) discard;
          float a = exp(-r * 4.2) * vA;
          vec3 warm = vec3(0.95, 0.70, 0.34);
          vec3 cool = vec3(0.55, 0.85, 0.62);
          vec3 c = mix(warm, cool, 0.5 + 0.5 * sin(vS));
          gl_FragColor = vec4(c * a, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.mat = mat;
  }
  update(t) { this.mat.uniforms.uTime.value = t; }
}

/* The path she walked, fading behind her. */
class Trail {
  constructor(max = 420, rgb = [0.98, 0.76, 0.42]) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aA', new THREE.BufferAttribute(this.alpha, 1));
    geo.setDrawRange(0, 0);
    this.line = new THREE.Line(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aA; varying float vA;
        void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vA; uniform vec3 uCol;
        void main(){ gl_FragColor = vec4(uCol, vA * 0.85); }`,
      uniforms: { uCol: { value: new THREE.Color(rgb[0], rgb[1], rgb[2]) } },
    }));
    this.geo = geo; this.max = max;
  }
  set(points) {
    const n = Math.min(points.length, this.max);
    const off = points.length - n;
    for (let i = 0; i < n; i++) {
      const p = points[off + i];
      this.pos[i * 3] = p[0]; this.pos[i * 3 + 1] = 0.075; this.pos[i * 3 + 2] = p[1];
      this.alpha[i] = Math.pow(i / Math.max(n - 1, 1), 2.2);
    }
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aA.needsUpdate = true;
  }
}

/* A small stylised fly. The body is a few rounded forms; the legs are a real
   kinematic chain solved onto foot targets tracked in WORLD space, ported from
   the gait that was verified in the earlier build (tripod groups alternating,
   planted feet staying put while the body travels over them). That is what makes
   her read as walking rather than sliding. */

const LEGS = [
  { side: -1, z:  0.26, tripod: 0, femur: 0.30, tibia: 0.34, reach: [-0.32,  0.30] },
  { side:  1, z:  0.26, tripod: 1, femur: 0.30, tibia: 0.34, reach: [ 0.32,  0.30] },
  { side: -1, z:  0.02, tripod: 1, femur: 0.33, tibia: 0.37, reach: [-0.38,  0.02] },
  { side:  1, z:  0.02, tripod: 0, femur: 0.33, tibia: 0.37, reach: [ 0.38,  0.02] },
  { side: -1, z: -0.22, tripod: 0, femur: 0.37, tibia: 0.44, reach: [-0.36, -0.30] },
  { side:  1, z: -0.22, tripod: 1, femur: 0.37, tibia: 0.44, reach: [ 0.36, -0.30] },
];
const STRIDE = 0.34;
const UP = new THREE.Vector3(0, 1, 0);

class Legs {
  constructor(parent, scale) {
    this.scale = scale;
    this.feet = LEGS.map(L => new THREE.Vector3(L.reach[0] * scale, 0, L.reach[1] * scale));
    this.planted = LEGS.map(() => true);
    this.gait = 0;
    const mat = new THREE.MeshStandardMaterial({ color: 0x4A3722, roughness: 0.65, metalness: 0.05 });
    const geo = new THREE.CylinderGeometry(1, 0.78, 1, 6);
    this.seg = LEGS.map(() => [0.030, 0.024, 0.017].map(r => {
      const m = new THREE.Mesh(geo, mat);
      m.userData.r = r * scale;
      parent.add(m);
      return m;
    }));
    this.claw = LEGS.map(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.022 * scale, 8, 6), mat);
      parent.add(m); return m;
    });
  }

  /* place a cylinder so it runs from a to b */
  static bone(mesh, a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, d.normalize());
    mesh.scale.set(mesh.userData.r, len, mesh.userData.r);
  }

  update(x, y, heading, speed, dt) {
    const S = this.scale;
    const moving = Math.abs(speed) > 0.02;
    this.gait += dt * (3.2 + Math.abs(speed) * 11) * (moving ? 1 : 0);
    const fwd = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    const body = new THREE.Vector3(x, 0, y);

    for (let i = 0; i < LEGS.length; i++) {
      const L = LEGS[i];
      const home = body.clone()
        .addScaledVector(right, L.reach[0] * S)
        .addScaledVector(fwd, L.reach[1] * S);
      const foot = this.feet[i];
      if (!moving) {
        foot.lerp(home, Math.min(1, dt * 4));
        foot.y = 0;
        this.planted[i] = true;
      } else {
        const ph = (this.gait / (Math.PI * 2) + (L.tripod ? 0.5 : 0)) % 1;
        if (ph <= 0.5) {                       // stance: the ground holds it
          foot.y = 0;
          this.planted[i] = true;
        } else {                               // swing: arc to the next foothold
          const u = (ph - 0.5) * 2;
          const sgn = Math.sign(speed || 1);
          const from = home.clone().addScaledVector(fwd, -STRIDE * 0.5 * S * sgn);
          const to = home.clone().addScaledVector(fwd, STRIDE * 0.5 * S * sgn);
          foot.lerpVectors(from, to, u);
          foot.y = Math.sin(u * Math.PI) * 0.13 * S;
          this.planted[i] = false;
        }
      }

      const coxa = body.clone()
        .addScaledVector(right, L.side * 0.125 * S)
        .addScaledVector(fwd, L.z * S);
      coxa.y = 0.10 * S;
      const hip = body.clone()
        .addScaledVector(right, L.side * 0.20 * S)
        .addScaledVector(fwd, L.z * S);
      hip.y = 0.055 * S;
      const hint = hip.clone().addScaledVector(right, L.side * 1.2 * S).setY(hip.y + 0.9 * S);
      const knee = solveIK(hip, foot, L.femur * S, L.tibia * S, hint);
      const ankle = knee.clone().lerp(foot, 0.82);
      Legs.bone(this.seg[i][0], coxa, hip);
      Legs.bone(this.seg[i][1], hip, knee);
      Legs.bone(this.seg[i][2], knee, ankle);
      this.claw[i].position.copy(foot);
    }
  }
}

/* two-link IK: where the knee goes, given hip, foot and segment lengths */
function solveIK(hip, foot, l1, l2, hint) {
  const d = new THREE.Vector3().subVectors(foot, hip);
  const raw = d.length() || 1e-4;
  const D = Math.min(Math.max(raw, Math.abs(l1 - l2) + 1e-3), (l1 + l2) * 0.995);
  const dir = d.clone().multiplyScalar(1 / raw);
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D)));
  const a = Math.acos(cosA);
  let up = new THREE.Vector3().subVectors(hint, hip);
  up.addScaledVector(dir, -up.dot(dir));
  if (up.lengthSq() < 1e-8) up.set(0, 1, 0);
  up.normalize();
  return hip.clone()
    .addScaledVector(dir, Math.cos(a) * l1)
    .addScaledVector(up, Math.sin(a) * l1);
}

function buildFly(parent, scale = 1.9) {
  const g = new THREE.Group();
  parent.add(g);
  const body = (c, rough = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.05 });
  const S = new THREE.SphereGeometry(0.5, 20, 14);
  const add = (geo, mat, x, y, z, sx, sy, sz) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m;
  };
  add(S, body(0x53401F), 0, 0.075, -0.16, 0.26, 0.23, 0.38);       // abdomen
  add(S, body(0x8A6838), 0, 0.105, 0.09, 0.27, 0.25, 0.28);        // thorax
  add(S, body(0x77582F), 0, 0.105, 0.28, 0.21, 0.20, 0.18);        // head
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xF0443A, emissive: 0xE8342A, emissiveIntensity: 2.6, roughness: 0.28 });
  add(S, eyeMat, -0.085, 0.125, 0.31, 0.13, 0.15, 0.13);
  add(S, eyeMat, 0.085, 0.125, 0.31, 0.13, 0.15, 0.13);
  const wingMat = new THREE.MeshPhysicalMaterial({
    color: 0xE4F2F6, transmission: 0.6, thickness: 0.02, roughness: 0.16,
    transparent: true, opacity: 0.42, side: THREE.DoubleSide, metalness: 0 });
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = add(new THREE.CircleGeometry(0.5, 18, 0, Math.PI), wingMat,
      sx * 0.07, 0.19, -0.10, 0.34, 1, 0.62);
    w.rotation.x = -Math.PI / 2;
    wings.push(w);
  }
  g.scale.setScalar(scale);
  const legs = new Legs(parent, scale);
  return {
    group: g, legs,
    place(x, y, heading, speed, dt, t) {
      g.position.set(x, 0.02, y);
      g.rotation.y = -heading + Math.PI;
      legs.update(x, y, heading, speed, dt);
      const beat = Math.sin(t * 20) * 0.07;
      wings[0].rotation.z = -0.30 - beat;
      wings[1].rotation.z = 0.30 + beat;
      g.position.y = 0.02 + Math.sin(legs.gait * 2) * 0.006 * scale;
    },
  };
}
