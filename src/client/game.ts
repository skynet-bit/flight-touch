import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// ══════════════════════════════════════════════════════
//  RENDERER & SCENE SETUP
// ══════════════════════════════════════════════════════
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// FIX 1: Set clear color to match sky/fog to prevent black void from extreme camera far-clipping
renderer.setClearColor(0x8ecbf0);

const scene = new THREE.Scene();

// Kept fog density low for 14,000 ft visibility
scene.fog = new THREE.FogExp2(0x8ecbf0, 0.00008);

// Sky dome (Expanded drastically so it renders below the high-altitude horizon)
const skyMat = new THREE.ShaderMaterial({
  uniforms: {
    top: { value: new THREE.Color(0x0044aa) },
    mid: { value: new THREE.Color(0x3399dd) },
    bot: { value: new THREE.Color(0xaaddff) },
  },
  vertexShader: `
    varying float vY;
    void main(){
      vec4 wp = modelMatrix * vec4(position,1.0);
      vY = normalize(wp.xyz).y;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }`,
  fragmentShader: `
    varying float vY;
    uniform vec3 top, mid, bot;
    void main(){
      float t1 = clamp(vY * 2.0, 0.0, 1.0);
      float t2 = clamp(vY * 6.0, 0.0, 1.0);
      vec3 c = mix(bot, mid, t2);
      c = mix(c, top, t1);
      gl_FragColor = vec4(c, 1.0);
    }`,
  side: THREE.BackSide,
  depthWrite: false,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(45000, 32, 16), skyMat));

// Camera (Expanded Far clip plane massively from 25000 to 60000 to solve the black-cutoff issue)
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 60000);
camera.position.set(0, 10, 30);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.38));
const sun = new THREE.DirectionalLight(0xfff5d0, 1.7);
sun.position.set(350, 500, 200);
sun.castShadow = true;
Object.assign(sun.shadow, { bias: -0.0004 });
Object.assign(sun.shadow.mapSize, { width: 2048, height: 2048 });
const sc = sun.shadow.camera;
sc.near = 1;
sc.far = 2500;
sc.left = sc.bottom = -700;
sc.right = sc.top = 700;
scene.add(sun);
scene.add(sun.target);

const sunDisc = new THREE.Mesh(
  new THREE.SphereGeometry(28, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xfffde0 })
);
sunDisc.position.copy(sun.position).normalize().multiplyScalar(3000);
scene.add(sunDisc);
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3d5530, 0.45));

// FIX 2: Infinite Base Ground Plane
const baseGround = new THREE.Mesh(
  new THREE.PlaneGeometry(100000, 100000),
  new THREE.MeshLambertMaterial({ color: 0x1a241c }) // Dark city/ground base color
);
baseGround.rotation.x = -Math.PI / 2;
baseGround.position.y = -2; // Positioned safely just beneath the actual 3D city chunks
scene.add(baseGround);

// ══════════════════════════════════════════════════════
//  MODEL LOADING & ENDLESS CITY SETUP
// ══════════════════════════════════════════════════════
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(dracoLoader);

const jetGroup = new THREE.Group();
scene.add(jetGroup);

let groundY = 0,
  jetGroundOff = 20,
  loadsDone = 0;

// Variables for Endless City Tiling
let cityChunks: THREE.Group[] = [];
let chunkSizeX = 1800;
let chunkSizeZ = 1800;
let lastChunkX = 0;
let lastChunkZ = 0;

function checkAllLoaded() {
  loadsDone++;
  if (loadsDone >= 2) {
    (document.getElementById('loading') as HTMLDivElement).style.display = 'none';
    (document.getElementById('menu') as HTMLDivElement).style.display = 'flex';
  }
}

gltfLoader.load(
  'assets/city.glb',
  (gltf) => {
    const world = gltf.scene;
    world.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) {
        n.receiveShadow = true;
        n.castShadow = true;
      }
    });
    const bb = new THREE.Box3().setFromObject(world);
    const sz = bb.getSize(new THREE.Vector3());
    const ctr = bb.getCenter(new THREE.Vector3());

    const sc2 = 1800 / Math.max(sz.x, sz.y, sz.z);
    world.scale.setScalar(sc2);
    world.position.set(-ctr.x * sc2, -bb.min.y * sc2, -ctr.z * sc2);

    chunkSizeX = sz.x * sc2 * 0.68;
    chunkSizeZ = sz.z * sc2 * 0.68;

    const templateGroup = new THREE.Group();
    templateGroup.add(world);

    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        const chunk = templateGroup.clone() as THREE.Group;
        chunk.position.set(x * chunkSizeX, 0, z * chunkSizeZ);
        scene.add(chunk);
        cityChunks.push(chunk);
      }
    }

    checkAllLoaded();
  },
  undefined,
  () => checkAllLoaded()
);

gltfLoader.load(
  'assets/f16.glb',
  (gltf) => {
    const model = gltf.scene;
    model.traverse((n) => {
      if ((n as THREE.Mesh).isMesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
    const bb = new THREE.Box3().setFromObject(model);
    const sz = bb.getSize(new THREE.Vector3());
    const ctr = bb.getCenter(new THREE.Vector3());
    const sc3 = 14 / Math.max(sz.x, sz.y, sz.z);

    model.rotation.y = Math.PI;
    model.position.set(-ctr.x * sc3, ctr.y * sc3, -ctr.z * sc3);
    jetGroup.add(model);
    jetGroundOff = (sz.y * sc3) / 2 + 0.4;
    checkAllLoaded();
  },
  undefined,
  () => checkAllLoaded()
);

// ══════════════════════════════════════════════════════
//  FLIGHT STATE & PHYSICS
// ══════════════════════════════════════════════════════
const START_X = 0;
const START_Z = 0;

interface FlightState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  pitch: number;
  roll: number;
  yaw: number;
  thr: number;
  pitchIn: number;
  rollIn: number;
  yawIn: number;
  flaps: boolean;
  gear: boolean;
  crashed: boolean;
  paused: boolean;
  started: boolean;
}

const FS: FlightState = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  pitch: 0,
  roll: 0,
  yaw: 0,
  thr: 0.8,
  pitchIn: 0,
  rollIn: 0,
  yawIn: 0,
  flaps: false,
  gear: false,
  crashed: false,
  paused: false,
  started: false,
};

const G = 9.81,
  MAX_THR = 62,
  DRAG_BASE = 0.0048,
  DRAG_GEAR = 0.0048,
  DRAG_FLAPS = 0.002;
const LIFT_K = 0.003,
  LIFT_FLAPS = 0.0016;

const PITCH_RATE = 1.4375,
  ROLL_RATE = 2.25,
  YAW_RATE = 0.6875;

const STALL_V = 32,
  EFF_V_FULL = 65,
  CRASH_VY = -5.5,
  CRASH_PITCH = 0.38,
  CRASH_ROLL = 0.85;
const CAM_BACK = 22,
  CAM_UP = 6,
  CAM_LERP = 0.055;

const _q = new THREE.Quaternion(),
  _e = new THREE.Euler(),
  _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(),
  _cOff = new THREE.Vector3(),
  _cTgt = new THREE.Vector3();
const _lkAt = new THREE.Vector3(),
  _dvel = new THREE.Vector3();

function computeMinY() {
  return groundY + jetGroundOff;
}

function resetFlight() {
  const minY = computeMinY();
  const startAltitudeMeters = 467;
  FS.pos.set(START_X, minY + startAltitudeMeters, START_Z);
  FS.vel.set(0, 0, -80);
  FS.pitch = 0;
  FS.roll = 0;
  FS.yaw = 0;
  FS.thr = 0.8;
  FS.pitchIn = 0;
  FS.rollIn = 0;
  FS.yawIn = 0;
  FS.flaps = false;
  FS.gear = false;
  FS.crashed = false;
  FS.paused = false;

  throttleCtrl.set(0.8);
  joystickCtrl.reset();
  rudderCtrl.reset();
  updateGearUI();
  updateFlapsUI();

  document.querySelectorAll('.overlay').forEach((el) => ((el as HTMLElement).style.display = 'none'));
  (document.getElementById('stall-warn') as HTMLElement).style.display = 'none';
  _cOff.set(0, CAM_UP, CAM_BACK);
  camera.position.copy(FS.pos).add(_cOff);
  camera.lookAt(FS.pos);
}

function updatePhysics(dt: number) {
  if (!FS.started || FS.crashed || FS.paused) return;

  const spd = FS.vel.length();
  const eff = Math.min(1, Math.max(0, (spd - 4) / (EFF_V_FULL - 4)));

  _e.set(FS.pitch, FS.yaw, FS.roll, 'YXZ');
  _q.setFromEuler(_e);
  _fwd.set(0, 0, -1).applyQuaternion(_q);
  _up.set(0, 1, 0).applyQuaternion(_q);

  FS.vel.addScaledVector(_fwd, FS.thr * MAX_THR * dt);
  FS.vel.y -= G * dt;

  const lk = LIFT_K + (FS.flaps ? LIFT_FLAPS : 0);
  let liftA = lk * spd * spd;

  if (liftA > G * 1.2) {
    liftA = G * 1.2 + (liftA - G * 1.2) * 0.02;
  }
  FS.vel.addScaledVector(_up, liftA * dt);

  const dk = DRAG_BASE + (FS.gear ? DRAG_GEAR : 0) + (FS.flaps ? DRAG_FLAPS : 0);
  let dragMultiplier = dk * spd;

  if (dragMultiplier > 0.18) {
    dragMultiplier = 0.18 + (dragMultiplier - 0.18) * 0.05;
  }

  _dvel.copy(FS.vel).multiplyScalar(dragMultiplier * dt);
  FS.vel.sub(_dvel);

  const localPitch = FS.pitchIn * PITCH_RATE * eff * dt;
  const localRoll = -FS.rollIn * ROLL_RATE * eff * dt;
  const localYaw = -FS.yawIn * YAW_RATE * eff * dt;

  FS.pitch += localPitch * Math.cos(FS.roll) - localYaw * Math.sin(FS.roll);
  FS.yaw += localPitch * Math.sin(FS.roll) + localYaw * Math.cos(FS.roll);
  FS.roll += localRoll;

  FS.roll *= 0.994;
  FS.pitch = Math.max(-Math.PI * 0.46, Math.min(Math.PI * 0.46, FS.pitch));
  FS.roll = Math.max(-Math.PI, Math.min(Math.PI, FS.roll));

  FS.pos.addScaledVector(FS.vel, dt);

  const minY = computeMinY();
  if (FS.pos.y <= minY) {
    if (FS.vel.y < CRASH_VY || Math.abs(FS.pitch) > CRASH_PITCH || Math.abs(FS.roll) > CRASH_ROLL) {
      triggerCrash();
      return;
    }
    FS.pos.y = minY;
    FS.vel.y = 0;
    FS.vel.x *= 0.968;
    FS.vel.z *= 0.968;
    FS.roll *= 0.88;
    FS.pitch *= 0.9;
  }

  jetGroup.position.copy(FS.pos);
  _e.set(FS.pitch, FS.yaw, FS.roll, 'YXZ');
  jetGroup.setRotationFromEuler(_e);

  baseGround.position.x = FS.pos.x;
  baseGround.position.z = FS.pos.z;

  if (cityChunks.length > 0) {
    const currentChunkX = Math.round(FS.pos.x / chunkSizeX);
    const currentChunkZ = Math.round(FS.pos.z / chunkSizeZ);

    if (currentChunkX !== lastChunkX || currentChunkZ !== lastChunkZ) {
      let index = 0;
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          cityChunks[index].position.set(
            (currentChunkX + x) * chunkSizeX,
            0,
            (currentChunkZ + z) * chunkSizeZ
          );
          index++;
        }
      }
      lastChunkX = currentChunkX;
      lastChunkZ = currentChunkZ;
    }
  }

  sun.target.position.copy(FS.pos);
  sun.target.updateMatrixWorld();

  _cOff.set(0, CAM_UP, CAM_BACK).applyQuaternion(_q);
  _cTgt.copy(FS.pos).add(_cOff);
  camera.position.lerp(_cTgt, CAM_LERP);
  _lkAt.set(0, 0, -35).applyQuaternion(_q).add(FS.pos);
  camera.lookAt(_lkAt);

  updateHUD(spd, minY);
}

function updateHUD(spd: number, minY: number) {
  const spdKt = spd * 1.944;
  const altFt = Math.max(0, FS.pos.y - minY) * 3.281;
  const vsFpm = FS.vel.y * 196.85;
  const hdg = (((FS.yaw * 180) / Math.PI % 360) + 360) % 360;

  (document.getElementById('hv-spd') as HTMLElement).textContent = `SPD: ${Math.round(spdKt)} kt`;
  (document.getElementById('hv-alt') as HTMLElement).textContent = `ALT: ${Math.round(altFt)} ft`;
  (document.getElementById('hv-vs') as HTMLElement).textContent = ` V/S: ${Math.round(vsFpm)}`;
  (document.getElementById('hv-hdg') as HTMLElement).textContent = `HDG: ${Math.round(hdg)}°`;

  const stallV = STALL_V * (FS.flaps ? 0.78 : 1.0);
  (document.getElementById('stall-warn') as HTMLElement).style.display =
    spd < stallV && FS.pos.y > minY + 2 ? 'block' : 'none';
}

function triggerCrash() {
  FS.crashed = true;
  (document.getElementById('crashOverlay') as HTMLElement).style.display = 'flex';
}

// ══════════════════════════════════════════════════════
//  REFINED TOUCH CONTROLS
// ══════════════════════════════════════════════════════
const touchOwner: Record<number, string> = {};

// Throttle
const throttleCtrl = (() => {
  const track = document.getElementById('throttle-track') as HTMLElement,
    thumb = document.getElementById('throttle-thumb') as HTMLElement;
  const fill = document.getElementById('throttle-fill') as HTMLElement,
    pctEl = document.getElementById('thr-pct') as HTMLElement;

  function set(v: number) {
    v = Math.max(0, Math.min(1, v));
    FS.thr = v;
    const h = track.clientHeight - 36;
    thumb.style.transform = `translateY(${-v * h}px)`;
    fill.style.height = v * 100 + '%';
    pctEl.textContent = Math.round(v * 100) + '%';
  }

  function fromTouch(t: Touch) {
    const r = track.getBoundingClientRect();
    set((r.bottom - t.clientY) / r.height);
  }

  track.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        touchOwner[t.identifier] = 'throttle';
        fromTouch(t);
      }
    },
    { passive: false }
  );

  return { set, fromTouch };
})();

// Joystick (Pitch & Roll)
const joystickCtrl = (() => {
  const base = document.getElementById('joystick-base') as HTMLElement,
    thumb = document.getElementById('joystick-thumb') as HTMLElement;
  const R = 46;

  function reset() {
    FS.pitchIn = 0;
    FS.rollIn = 0;
    thumb.style.transform = `translate(0,0)`;
  }

  function fromTouch(t: Touch) {
    const r = base.getBoundingClientRect();
    const cx = r.left + r.width / 2,
      cy = r.top + r.height / 2;
    const dx = t.clientX - cx,
      dy = t.clientY - cy;
    const d = Math.sqrt(dx * dx + dy * dy),
      cl = Math.min(d, R);
    const a = Math.atan2(dy, dx);
    const nx = Math.cos(a) * cl,
      ny = Math.sin(a) * cl;

    thumb.style.transform = `translate(${nx}px, ${ny}px)`;
    FS.rollIn = nx / R;
    FS.pitchIn = -(ny / R);
  }

  base.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        touchOwner[t.identifier] = 'joystick';
        fromTouch(t);
      }
    },
    { passive: false }
  );

  return { reset, fromTouch };
})();

// Rudder (Yaw)
const rudderCtrl = (() => {
  const track = document.getElementById('rudder-track') as HTMLElement,
    thumb = document.getElementById('rudder-thumb') as HTMLElement;
  const fillL = document.getElementById('rudder-fill-l') as HTMLElement,
    fillR = document.getElementById('rudder-fill-r') as HTMLElement;
  let retId: ReturnType<typeof setInterval> | null = null;

  function setVal(v: number) {
    v = Math.max(-1, Math.min(1, v));
    FS.yawIn = v;
    const range = track.clientWidth / 2 - 20;
    thumb.style.transform = `translateX(${v * range}px)`;
    fillL.style.width = v < 0 ? Math.abs(v) * 50 + '%' : '0';
    fillR.style.width = v > 0 ? v * 50 + '%' : '0';
  }

  function fromTouch(t: Touch) {
    const r = track.getBoundingClientRect();
    setVal((t.clientX - (r.left + r.width / 2)) / (r.width / 2));
  }

  function startReturn() {
    if (retId) return;
    retId = setInterval(() => {
      FS.yawIn *= 0.8;
      if (Math.abs(FS.yawIn) < 0.01) {
        FS.yawIn = 0;
        if (retId) clearInterval(retId);
        retId = null;
      }
      setVal(FS.yawIn);
    }, 20);
  }

  function reset() {
    if (retId) {
      clearInterval(retId);
      retId = null;
    }
    setVal(0);
  }

  track.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      reset();
      for (const t of Array.from(e.changedTouches)) {
        touchOwner[t.identifier] = 'rudder';
        fromTouch(t);
      }
    },
    { passive: false }
  );

  return { reset, fromTouch, startReturn };
})();

// Global Touch Move
document.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      const o = touchOwner[t.identifier];
      if (o === 'throttle') throttleCtrl.fromTouch(t);
      else if (o === 'joystick') joystickCtrl.fromTouch(t);
      else if (o === 'rudder') rudderCtrl.fromTouch(t);
    }
  },
  { passive: false }
);

document.addEventListener('touchend', (e) => {
  for (const t of Array.from(e.changedTouches)) {
    const o = touchOwner[t.identifier];
    if (o === 'joystick') joystickCtrl.reset();
    if (o === 'rudder') rudderCtrl.startReturn();
    delete touchOwner[t.identifier];
  }
});

// ══════════════════════════════════════════════════════
//  UI & LOOP
// ══════════════════════════════════════════════════════
function updateGearUI() {
  const btn = document.getElementById('gear-btn') as HTMLElement,
    hp = document.getElementById('hp-gear') as HTMLElement;
  btn.textContent = FS.gear ? 'GEAR ▼ DN' : 'GEAR ▲ UP';
  btn.className = FS.gear ? 'act-btn' : 'act-btn up';
  hp.className = FS.gear ? 'hp green' : 'hp red';
}

function updateFlapsUI() {
  const btn = document.getElementById('flaps-btn') as HTMLElement,
    hp = document.getElementById('hp-flaps') as HTMLElement;
  btn.textContent = FS.flaps ? 'FLAPS ON' : 'FLAPS OFF';
  btn.className = FS.flaps ? 'act-btn on' : 'act-btn';
  hp.className = FS.flaps ? 'hp amber' : 'hp green';
}

(document.getElementById('gear-btn') as HTMLElement).onclick = () => {
  FS.gear = !FS.gear;
  updateGearUI();
};
(document.getElementById('flaps-btn') as HTMLElement).onclick = () => {
  FS.flaps = !FS.flaps;
  updateFlapsUI();
};
(document.getElementById('startBtn') as HTMLElement).onclick = () => {
  (document.getElementById('menu') as HTMLElement).style.display = 'none';
  (document.getElementById('hud') as HTMLElement).style.display = 'block';
  (document.getElementById('controls') as HTMLElement).style.display = 'block';
  FS.started = true;
  resetFlight();
};
document.querySelectorAll('#resumeBtn, #restartBtn, #crashRestartBtn').forEach((btn) => {
  (btn as HTMLElement).onclick = () => resetFlight();
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

let lastT = 0;
function animate(t: number) {
  requestAnimationFrame(animate);
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  updatePhysics(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
