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

renderer.setClearColor(0x8ecbf0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x8ecbf0, 0.00008);

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

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 60000);
camera.position.set(0, 10, 30);

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

const baseGround = new THREE.Mesh(
  new THREE.PlaneGeometry(100000, 100000),
  new THREE.MeshLambertMaterial({ color: 0x1a241c })
);
baseGround.rotation.x = -Math.PI / 2;
baseGround.position.y = -2;
scene.add(baseGround);

// ══════════════════════════════════════════════════════
//  MODEL LOADING
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
//  FLIGHT STATE & ENHANCED PHYSICS
// ══════════════════════════════════════════════════════
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
  // Inertia states
  curPitchRate: number;
  curRollRate: number;
  curYawRate: number;
  // Combat & Progress
  hp: number;
  maxHp: number;
  credits: number;
  level: number;
  kills: number;
  lastFire: number;
  shopOpen: boolean;
  // Upgrades
  upgrades: {
    engine: number;
    weapon: number;
    armor: number;
  };
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
  curPitchRate: 0,
  curRollRate: 0,
  curYawRate: 0,
  hp: 100,
  maxHp: 100,
  credits: 0,
  level: 1,
  kills: 0,
  lastFire: 0,
  shopOpen: false,
  upgrades: {
    engine: 0,
    weapon: 0,
    armor: 0,
  },
};

// ══════════════════════════════════════════════════════
//  COMBAT & AI SYSTEMS
// ══════════════════════════════════════════════════════
interface Bullet {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  isEnemy: boolean;
}

interface Enemy {
  mesh: THREE.Group;
  vel: THREE.Vector3;
  hp: number;
  lastFire: number;
}

let bullets: Bullet[] = [];
let enemies: Enemy[] = [];
const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const bulletGeom = new THREE.SphereGeometry(0.5, 8, 8);
const enemyMat = new THREE.MeshLambertMaterial({ color: 0xff4444 });

function spawnEnemy() {
  const enemy = new THREE.Group();
  // Reuse the jet model for enemies but color them red
  const model = jetGroup.children[0].clone() as THREE.Group;
  model.traverse((n) => {
    if ((n as THREE.Mesh).isMesh) {
      (n as THREE.Mesh).material = enemyMat;
    }
  });
  enemy.add(model);
  
  // Random position around player
  const angle = Math.random() * Math.PI * 2;
  const dist = 1000 + Math.random() * 1000;
  enemy.position.set(
    FS.pos.x + Math.cos(angle) * dist,
    FS.pos.y + 100 + Math.random() * 500,
    FS.pos.z + Math.sin(angle) * dist
  );
  
  scene.add(enemy);
  enemies.push({
    mesh: enemy,
    vel: new THREE.Vector3(
      (Math.random() - 0.5) * 100,
      0,
      (Math.random() - 0.5) * 100
    ),
    hp: 50 + FS.level * 20,
    lastFire: 0,
  });
}

function fireBullet(isEnemy: boolean, pos: THREE.Vector3, dir: THREE.Vector3, speed: number) {
  const mesh = new THREE.Mesh(bulletGeom, bulletMat);
  mesh.position.copy(pos);
  scene.add(mesh);
  
  const vel = dir.clone().multiplyScalar(speed);
  bullets.push({ mesh, vel, life: 2.5, isEnemy });
}

function updateCombat(dt: number) {
  // 1. Update Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    
    // Collision detection
    if (!b.isEnemy) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (b.mesh.position.distanceTo(e.mesh.position) < 20) {
          e.hp -= 20;
          b.life = 0;
          if (e.hp <= 0) {
            FS.credits += 100;
            FS.kills++;
            scene.remove(e.mesh);
            enemies.splice(j, 1);
            checkLevelProgress();
          }
        }
      }
    } else {
      if (b.mesh.position.distanceTo(FS.pos) < 10) {
        takeDamage(10);
        b.life = 0;
      }
    }
    
    if (b.life <= 0) {
      scene.remove(b.mesh);
      bullets.splice(i, 1);
    }
  }

  // 2. Update Enemies
  const now = Date.now();
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    
    // AI Behavior: Fly towards player
    const toPlayer = FS.pos.clone().sub(e.mesh.position);
    const dist = toPlayer.length();
    toPlayer.normalize();
    
    // Rotate enemy to face player
    e.mesh.lookAt(FS.pos);
    
    // Move forward
    const spd = 60 + FS.level * 5;
    e.vel.lerp(toPlayer.multiplyScalar(spd), dt * 0.5);
    e.mesh.position.addScaledVector(e.vel, dt);
    
    // Fire at player
    if (dist < 800 && now - e.lastFire > 2000) {
      fireBullet(true, e.mesh.position, toPlayer, spd + 200);
      e.lastFire = now;
    }
    
    // Self-destruct if too far
    if (dist > 5000) {
      scene.remove(e.mesh);
      enemies.splice(i, 1);
    }
  }
  
  // Spawn more enemies if needed
  if (enemies.length < 1 + Math.floor(FS.level / 2) && FS.started && !FS.crashed) {
    if (Math.random() < 0.01) spawnEnemy();
  }
}

function takeDamage(amt: number) {
  const reduction = FS.upgrades.armor * 2;
  FS.hp -= Math.max(1, amt - reduction);
  if (FS.hp <= 0) {
    FS.hp = 0;
    triggerCrash("Aircraft destroyed by enemy fire");
  }
}

function checkLevelProgress() {
  const killsNeeded = FS.level * 3;
  if (FS.kills >= killsNeeded) {
    FS.level++;
    FS.kills = 0;
    // Level up reward
    FS.credits += 500;
    console.log("LEVEL UP! Now Level " + FS.level);
  }
}

function buyUpgrade(type: 'engine' | 'weapon' | 'armor') {
  const costs = { engine: 500, weapon: 800, armor: 600 };
  const cost = costs[type];
  if (FS.credits >= cost) {
    FS.credits -= cost;
    FS.upgrades[type]++;
    updateShopUI();
    console.log("Bought upgrade: " + type);
  }
}

function updateShopUI() {
  (document.getElementById('shop-credits') as HTMLElement).textContent = `Credits: ${FS.credits}`;
  // Update button texts if needed or disable if can't afford
}

const G = 9.81,
  MAX_THR = 75; // Slightly increased for more power
const DRAG_BASE = 0.004,
  DRAG_GEAR = 0.005,
  DRAG_FLAPS = 0.003;
const LIFT_K = 0.0035,
  LIFT_FLAPS = 0.0018;

const PITCH_SENS = 1.8,
  ROLL_SENS = 2.8,
  YAW_SENS = 0.8;
const INERTIA = 0.15; // Lower = snappier, Higher = smoother/more sluggish

const STALL_V = 30,
  EFF_V_FULL = 70;
const CRASH_VY = -6.0,
  CRASH_PITCH = 0.4,
  CRASH_ROLL = 0.9;

const CAM_DIST = 24,
  CAM_HEIGHT = 5,
  CAM_SMOOTH = 0.12; // Increased for better tracking

const _q = new THREE.Quaternion(),
  _e = new THREE.Euler(),
  _fwd = new THREE.Vector3();
const _up = new THREE.Vector3(),
  _right = new THREE.Vector3(),
  _cTgt = new THREE.Vector3();
const _lkAt = new THREE.Vector3(),
  _dvel = new THREE.Vector3();

function computeMinY() {
  return groundY + jetGroundOff;
}

function resetFlight() {
  const minY = computeMinY();
  FS.pos.set(0, minY + 500, 0);
  FS.vel.set(0, 0, -90);
  FS.pitch = FS.roll = FS.yaw = 0;
  FS.curPitchRate = FS.curRollRate = FS.curYawRate = 0;
  FS.thr = 0.8;
  FS.crashed = FS.paused = false;

  throttleCtrl.set(0.8);
  joystickCtrl.reset();
  rudderCtrl.reset();
  updateGearUI();
  updateFlapsUI();

  document.querySelectorAll('.overlay').forEach((el) => ((el as HTMLElement).style.display = 'none'));
  (document.getElementById('stall-warn') as HTMLElement).style.display = 'none';

  // Instant camera placement on reset
  _e.set(FS.pitch, FS.yaw, FS.roll, 'YXZ');
  _q.setFromEuler(_e);
  _fwd.set(0, 0, -1).applyQuaternion(_q);
  const back = _fwd.clone().multiplyScalar(-CAM_DIST);
  camera.position.copy(FS.pos).add(back).add(new THREE.Vector3(0, CAM_HEIGHT, 0));
  camera.lookAt(FS.pos);
}

function updatePhysics(dt: number) {
  if (!FS.started || FS.crashed || FS.paused) return;

  const spd = FS.vel.length();
  const eff = Math.min(1.2, Math.max(0.1, spd / EFF_V_FULL));

  // 1. Directional Vectors
  _e.set(FS.pitch, FS.yaw, FS.roll, 'YXZ');
  _q.setFromEuler(_e);
  _fwd.set(0, 0, -1).applyQuaternion(_q);
  _up.set(0, 1, 0).applyQuaternion(_q);
  _right.set(1, 0, 0).applyQuaternion(_q);

  // 2. Thrust & Gravity
  const engineBonus = 1 + FS.upgrades.engine * 0.15;
  FS.vel.addScaledVector(_fwd, FS.thr * MAX_THR * engineBonus * dt);
  FS.vel.y -= G * dt;

  // 3. Lift with AoA (Angle of Attack) Approximation
  const liftFactor = LIFT_K + (FS.flaps ? LIFT_FLAPS : 0);
  const verticalLift = liftFactor * spd * spd * Math.cos(FS.roll);
  FS.vel.addScaledVector(_up, verticalLift * dt);

  // 4. Drag
  const dk = DRAG_BASE + (FS.gear ? DRAG_GEAR : 0) + (FS.flaps ? DRAG_FLAPS : 0);
  _dvel.copy(FS.vel).multiplyScalar(dk * spd * dt);
  FS.vel.sub(_dvel);

  // 5. Rotational Physics with Inertia
  const targetPitchRate = FS.pitchIn * PITCH_SENS * eff;
  const targetRollRate = -FS.rollIn * ROLL_SENS * (0.5 + eff * 0.5);
  const targetYawRate = -FS.yawIn * YAW_SENS * eff;

  FS.curPitchRate += (targetPitchRate - FS.curPitchRate) * (dt / INERTIA);
  FS.curRollRate += (targetRollRate - FS.curRollRate) * (dt / INERTIA);
  FS.curYawRate += (targetYawRate - FS.curYawRate) * (dt / INERTIA);

  const turnInducedYaw = -Math.sin(FS.roll) * 0.5 * eff;
  FS.pitch += FS.curPitchRate * dt;
  FS.roll += FS.curRollRate * dt;
  FS.yaw += (FS.curYawRate + turnInducedYaw) * dt;

  FS.roll *= 0.99; 
  FS.pitch = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, FS.pitch));

  // 6. Update Position
  FS.pos.addScaledVector(FS.vel, dt);

  // 7. Ground Collision
  const minY = computeMinY();
  if (FS.pos.y <= minY) {
    if (FS.vel.y < CRASH_VY || Math.abs(FS.pitch) > CRASH_PITCH || Math.abs(FS.roll) > CRASH_ROLL) {
      triggerCrash("Aircraft destroyed on impact");
      return;
    }
    FS.pos.y = minY;
    FS.vel.y = 0;
    FS.vel.x *= 0.95;
    FS.vel.z *= 0.95;
    FS.roll *= 0.8;
    FS.pitch *= 0.8;
  }

  // 7.5 Update Combat
  updateCombat(dt);

  jetGroup.position.copy(FS.pos);
  _e.set(FS.pitch, FS.yaw, FS.roll, 'YXZ');
  jetGroup.setRotationFromEuler(_e);

  // 8. Endless World
  baseGround.position.set(FS.pos.x, -2, FS.pos.z);
  if (cityChunks.length > 0) {
    const cx = Math.round(FS.pos.x / chunkSizeX);
    const cz = Math.round(FS.pos.z / chunkSizeZ);
    if (cx !== lastChunkX || cz !== lastChunkZ) {
      let i = 0;
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          cityChunks[i++].position.set((cx + x) * chunkSizeX, 0, (cz + z) * chunkSizeZ);
        }
      }
      lastChunkX = cx; lastChunkZ = cz;
    }
  }

  // 9. ENHANCED CAMERA
  // We calculate a target camera position relative to the jet, but in world space to allow some lag
  _cTgt.copy(_fwd).multiplyScalar(-CAM_DIST).add(FS.pos);
  _cTgt.y += CAM_HEIGHT;
  
  // Smoothly move camera towards target
  camera.position.lerp(_cTgt, CAM_SMOOTH);
  
  // Always look at the jet (or slightly ahead)
  _lkAt.copy(_fwd).multiplyScalar(10).add(FS.pos);
  camera.lookAt(_lkAt);

  sun.target.position.copy(FS.pos);
  sun.target.updateMatrixWorld();
  updateHUD(spd, minY);
}

function updateHUD(spd: number, minY: number) {
  const spdKt = spd * 1.944;
  const altFt = Math.max(0, FS.pos.y - minY) * 3.281;
  const vsFpm = FS.vel.y * 196.85;
  const hdg = (((FS.yaw * 180) / Math.PI % 360) + 360) % 360;

  (document.getElementById('hv-lvl') as HTMLElement).textContent = `LVL: ${FS.level}`;
  (document.getElementById('hv-spd') as HTMLElement).textContent = `SPD: ${Math.round(spdKt)} kt`;
  (document.getElementById('hv-alt') as HTMLElement).textContent = `ALT: ${Math.round(altFt)} ft`;
  (document.getElementById('hv-pts') as HTMLElement).textContent = `PTS: ${FS.credits}`;
  (document.getElementById('hv-hdg') as HTMLElement).textContent = `HDG: ${Math.round(hdg)}°`;

  const stallV = STALL_V * (FS.flaps ? 0.75 : 1.0);
  (document.getElementById('stall-warn') as HTMLElement).style.display =
    spd < stallV && FS.pos.y > minY + 2 ? 'block' : 'none';
}

function triggerCrash(reason?: string) {
  FS.crashed = true;
  if (reason) (document.getElementById('crash-reason') as HTMLElement).textContent = reason;
  (document.getElementById('crashOverlay') as HTMLElement).style.display = 'flex';
}

function fireWeapon() {
  if (FS.crashed || FS.paused || !FS.started || FS.shopOpen) return;
  const now = Date.now();
  const fireRate = Math.max(100, 300 - FS.upgrades.weapon * 50);
  if (now - FS.lastFire > fireRate) {
    // Recalculate forward vector
    _e.set(FS.pitch, FS.yaw, FS.roll, 'YXZ');
    _q.setFromEuler(_e);
    _fwd.set(0, 0, -1).applyQuaternion(_q);
    
    fireBullet(false, FS.pos, _fwd, FS.vel.length() + 800);
    FS.lastFire = now;
  }
}

// ══════════════════════════════════════════════════════
//  TOUCH CONTROLS
// ══════════════════════════════════════════════════════
const touchOwner: Record<number, string> = {};

const throttleCtrl = (() => {
  const track = document.getElementById('throttle-track') as HTMLElement,
    thumb = document.getElementById('throttle-thumb') as HTMLElement,
    fill = document.getElementById('throttle-fill') as HTMLElement,
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
  track.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) { touchOwner[t.identifier] = 'throttle'; fromTouch(t); }
  }, { passive: false });
  return { set, fromTouch };
})();

const joystickCtrl = (() => {
  const base = document.getElementById('joystick-base') as HTMLElement,
    thumb = document.getElementById('joystick-thumb') as HTMLElement;
  const R = 46;
  function reset() { FS.pitchIn = FS.rollIn = 0; thumb.style.transform = `translate(0,0)`; }
  function fromTouch(t: Touch) {
    const r = base.getBoundingClientRect();
    const dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2);
    const d = Math.sqrt(dx * dx + dy * dy), cl = Math.min(d, R);
    const a = Math.atan2(dy, dx);
    const nx = Math.cos(a) * cl, ny = Math.sin(a) * cl;
    thumb.style.transform = `translate(${nx}px, ${ny}px)`;
    FS.rollIn = nx / R; FS.pitchIn = -(ny / R);
  }
  base.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) { touchOwner[t.identifier] = 'joystick'; fromTouch(t); }
  }, { passive: false });
  return { reset, fromTouch };
})();

const rudderCtrl = (() => {
  const track = document.getElementById('rudder-track') as HTMLElement,
    thumb = document.getElementById('rudder-thumb') as HTMLElement,
    fillL = document.getElementById('rudder-fill-l') as HTMLElement,
    fillR = document.getElementById('rudder-fill-r') as HTMLElement;
  let retId: ReturnType<typeof setInterval> | null = null;
  function setVal(v: number) {
    v = Math.max(-1, Math.min(1, v)); FS.yawIn = v;
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
      if (Math.abs(FS.yawIn) < 0.01) { FS.yawIn = 0; if (retId) clearInterval(retId); retId = null; }
      setVal(FS.yawIn);
    }, 20);
  }
  function reset() { if (retId) { clearInterval(retId); retId = null; } setVal(0); }
  track.addEventListener('touchstart', (e) => {
    e.preventDefault(); reset();
    for (const t of Array.from(e.changedTouches)) { touchOwner[t.identifier] = 'rudder'; fromTouch(t); }
  }, { passive: false });
  return { reset, fromTouch, startReturn };
})();

document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of Array.from(e.changedTouches)) {
    const o = touchOwner[t.identifier];
    if (o === 'throttle') throttleCtrl.fromTouch(t);
    else if (o === 'joystick') joystickCtrl.fromTouch(t);
    else if (o === 'rudder') rudderCtrl.fromTouch(t);
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  for (const t of Array.from(e.changedTouches)) {
    const o = touchOwner[t.identifier];
    if (o === 'joystick') joystickCtrl.reset();
    if (o === 'rudder') rudderCtrl.startReturn();
    delete touchOwner[t.identifier];
  }
});

// ══════════════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════════════
function updateGearUI() {
  const btn = document.getElementById('gear-btn') as HTMLElement, hp = document.getElementById('hp-gear') as HTMLElement;
  btn.textContent = FS.gear ? 'GEAR ▼ DN' : 'GEAR ▲ UP';
  btn.className = FS.gear ? 'act-btn' : 'act-btn up';
  hp.className = FS.gear ? 'hp green' : 'hp red';
}
function updateFlapsUI() {
  const btn = document.getElementById('flaps-btn') as HTMLElement, hp = document.getElementById('hp-flaps') as HTMLElement;
  btn.textContent = FS.flaps ? 'FLAPS ON' : 'FLAPS OFF';
  btn.className = FS.flaps ? 'act-btn on' : 'act-btn';
  hp.className = FS.flaps ? 'hp amber' : 'hp green';
}
(document.getElementById('gear-btn') as HTMLElement).onclick = () => { FS.gear = !FS.gear; updateGearUI(); };
(document.getElementById('flaps-btn') as HTMLElement).onclick = () => { FS.flaps = !FS.flaps; updateFlapsUI(); };
(document.getElementById('fire-btn') as HTMLElement).addEventListener('touchstart', (e) => {
  e.preventDefault();
  fireWeapon();
}, { passive: false });

(document.getElementById('shop-btn-in') as HTMLElement).onclick = () => {
  FS.shopOpen = true;
  FS.paused = true;
  updateShopUI();
  (document.getElementById('shopOverlay') as HTMLElement).style.display = 'flex';
};

(document.getElementById('closeShopBtn') as HTMLElement).onclick = () => {
  FS.shopOpen = false;
  FS.paused = false;
  (document.getElementById('shopOverlay') as HTMLElement).style.display = 'none';
};

document.querySelectorAll('.shop-buy').forEach((btn) => {
  (btn as HTMLElement).onclick = () => {
    const type = (btn as HTMLElement).dataset.upgrade as 'engine' | 'weapon' | 'armor';
    buyUpgrade(type);
  };
});

(document.getElementById('startBtn') as HTMLElement).onclick = () => {
  (document.getElementById('menu') as HTMLElement).style.display = 'none';
  (document.getElementById('hud') as HTMLElement).style.display = 'block';
  (document.getElementById('controls') as HTMLElement).style.display = 'block';
  FS.started = true; resetFlight();
};
document.querySelectorAll('#resumeBtn, #restartBtn, #crashRestartBtn').forEach((btn) => {
  (btn as HTMLElement).onclick = () => {
    // Reset combat state on restart
    bullets.forEach(b => scene.remove(b.mesh));
    enemies.forEach(e => scene.remove(e.mesh));
    bullets = [];
    enemies = [];
    FS.hp = FS.maxHp;
    resetFlight();
  };
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
