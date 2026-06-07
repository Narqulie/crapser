import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { createWorld, createDieBody, isSettled, hoverDie, launchDie } from './physics.js';
import {
  createDie,
  getTopFace,
  updateDieType,
  setupDieAnimations,
  updateAllDiceAnimations,
  unregisterDieAnimation,
} from './dice.js';
import { RogueRun } from './rogue-run.js';
import { RogueUI } from './rogue-ui.js';
import { MetaProgress, SETTLE_TIMEOUT } from './meta-progress.js';
import { ShopSystem } from './shop.js';
import { UI } from './ui.js';
import { AudioManager } from './audio.js';
import { callAnnouncement, callDead } from './announcer.js';
import { NPC_DEFS } from './npcs.js';
import { Pot } from './pot.js';

// ==== CONSTANTS ====
const SETTLE_FRAMES = 50;

// ==== SCENE SETUP ====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d1a);
scene.fog = new THREE.Fog(0x0d0d1a, 60, 200);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(16, 9, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.getElementById('app').appendChild(renderer.domElement);

// ==== POST-PROCESSING ====
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new FilmPass(0.8, 0.5, 200, false));

const rgbShift = new ShaderPass(RGBShiftShader);
rgbShift.uniforms['amount'].value = 0.003;
composer.addPass(rgbShift);

const vignette = new ShaderPass(VignetteShader);
vignette.uniforms['offset'].value = 0.6;
vignette.uniforms['darkness'].value = 1.2;
composer.addPass(vignette);

composer.addPass(new OutputPass());

// ==== CONTROLS ====
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, -1);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2.15;
controls.minDistance = 6;
controls.maxDistance = 60;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
controls.update();

// ==== LIGHTING ====
const ambient = new THREE.AmbientLight(0x222244, 0.5);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0x4466aa, 0x442222, 0.6);
scene.add(hemi);
const mainLight = new THREE.DirectionalLight(0xffcc66, 1.8);
mainLight.position.set(5, 12, 3);
mainLight.castShadow = true;
mainLight.shadow.mapSize.width = 1024;
mainLight.shadow.mapSize.height = 1024;
mainLight.shadow.camera.near = 0.5;
mainLight.shadow.camera.far = 20;
mainLight.shadow.camera.left = -12;
mainLight.shadow.camera.right = 10;
mainLight.shadow.camera.top = 8;
mainLight.shadow.camera.bottom = -8;
mainLight.shadow.bias = -0.0005;
scene.add(mainLight);

const streetLight = new THREE.PointLight(0xff8833, 40, 12, 2);
streetLight.position.set(0, 7, -1);
scene.add(streetLight);

const bulbGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0xff8833 }),
);
bulbGlow.position.copy(streetLight.position);
scene.add(bulbGlow);

// ==== ENVIRONMENT ====
function createCurbTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#555';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2000; i++) {
    const v = 60 + Math.random() * 80;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

const curbMat = new THREE.MeshStandardMaterial({
  map: createCurbTexture(),
  roughness: 0.95,
  metalness: 0.0,
});
for (const x of [-7, 7]) {
  const curbGeo = new THREE.BoxGeometry(0.2, 0.12, 14, 1, 1, 28);
  const curbPos = curbGeo.attributes.position;
  for (let i = 0; i < curbPos.count; i++) {
    const z = curbPos.getZ(i);
    if (Math.abs(z) > 0.05) {
      const d = (Math.random() - 0.5) * 0.03;
      curbPos.setXYZ(
        i,
        curbPos.getX(i) + (Math.random() - 0.5) * 0.02,
        curbPos.getY(i) + (Math.random() - 0.5) * 0.02,
        z + d,
      );
    }
  }
  curbPos.needsUpdate = true;
  curbGeo.computeVertexNormals();
  const curb = new THREE.Mesh(curbGeo, curbMat);
  curb.position.set(x, 0.06, -1);
  curb.receiveShadow = true;
  scene.add(curb);
}

function createGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 20000; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const v = 50 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 3, 3);
  }
  const s = canvas.width / 12;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(cx - 3.2 * s, cy - 2.2 * s, 6.4 * s, 4.4 * s);
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 1.8 * s, cy + 2.0 * s);
  ctx.lineTo(cx + 1.8 * s, cy + 2.0 * s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.font = `${Math.floor(0.35 * s)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('pass line', cx, cy + 1.95 * s);
  return new THREE.CanvasTexture(canvas);
}

const groundGeo = new THREE.PlaneGeometry(20, 20);
const groundMat = new THREE.MeshStandardMaterial({
  map: createGroundTexture(),
  roughness: 0.85,
  metalness: 0.0,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

function createWallTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#5a3a28';
  ctx.fillRect(0, 0, c.width, c.height);

  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const v = 60 + Math.random() * 50;
    ctx.fillStyle = `rgba(${v},${v * 0.6},${v * 0.3},${Math.random() * 0.4})`;
    ctx.fillRect(x, y, 3 + Math.random() * 6, 3 + Math.random() * 6);
  }

  const bh = 24,
    bw = 48,
    gap = 3;
  for (let row = 0; row < Math.ceil(c.height / (bh + gap)); row++) {
    for (let col = 0; col < Math.ceil(c.width / (bw + gap)) + 1; col++) {
      const offsetX = row % 2 === 0 ? 0 : (bw + gap) / 2;
      const x = col * (bw + gap) + offsetX + (Math.random() - 0.5) * 2;
      const y = row * (bh + gap) + (Math.random() - 0.5) * 2;
      const w = bw + (Math.random() - 0.5) * 4;
      const h = bh + (Math.random() - 0.5) * 3;
      const v = 80 + Math.random() * 60;
      ctx.fillStyle = `rgb(${v + 30}, ${v * 0.5 + 20}, ${v * 0.2 + 10})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

const wallMat = new THREE.MeshStandardMaterial({
  map: createWallTexture(),
  roughness: 0.95,
  metalness: 0.0,
});
const wallSegs = 24;
const wallGeo = new THREE.BoxGeometry(14, 8, 0.5, wallSegs, Math.floor(wallSegs * 0.6), 1);
const wallPos = wallGeo.attributes.position;
for (let i = 0; i < wallPos.count; i++) {
  const z = wallPos.getZ(i);
  if (Math.abs(z) > 0.2) {
    const d = (Math.random() - 0.5) * 0.15;
    wallPos.setXYZ(i, wallPos.getX(i), wallPos.getY(i), z + d);
  }
}
wallPos.needsUpdate = true;
wallGeo.computeVertexNormals();
const wallMesh = new THREE.Mesh(wallGeo, wallMat);
wallMesh.position.set(0, 4, -5.25);
wallMesh.castShadow = true;
wallMesh.receiveShadow = true;
scene.add(wallMesh);

const aimTargets = [ground, wallMesh];

const farTarget = new THREE.Mesh(
  new THREE.PlaneGeometry(24, 20),
  new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }),
);
farTarget.position.set(0, 4, -20);
scene.add(farTarget);
aimTargets.push(farTarget);

// ==== PHYSICS ====
const { world, wallBody, groundBody, dieMat } = createWorld();

const pot = new Pot(scene, world, groundBody, dieMat);

const DICE_OFFSET = 0.75;
const HOVER_Y = 3;
const HOVER_Z = 3.3;
const BET_CHIPS = [1, 2, 5, 10, 20];

/** Position both dice at their hover spots. If bobAmt is provided, adds sinusoidal bob animation. */
function positionDiceHover(diceArray, bobAmt = 0) {
  diceArray.forEach((d, i) => {
    if (d.body.position.y < 0.5) return;
    const x = i === 0 ? -DICE_OFFSET : DICE_OFFSET;
    const bob = bobAmt !== 0 ? Math.sin(bobAmt + i * 1.5) * 0.06 : 0;
    d.body.position.set(x, HOVER_Y + bob, HOVER_Z);
    d.body.velocity.set(0, 0, 0);
    d.body.angularVelocity.set(0, 0, 0);
  });
}

const audio = new AudioManager();

// ==== GAME STATE ====
const meta = new MetaProgress();
let shopSystem;
shopSystem = new ShopSystem(meta);
const rogueRun = new RogueRun(meta);
rogueRun.resetRun(meta.getBonuses()); // apply meta bonuses for initial run
const game = rogueRun.game;

// Initialize dice with typeIds from starting hand
const startingSlots = rogueRun.diceHandSlots;
const dice = [
  {
    mesh: createDie(startingSlots[0]?.typeId || 'house_bones'),
    body: createDieBody(),
    hitWall: false,
  },
  {
    mesh: createDie(startingSlots[1]?.typeId || 'house_bones'),
    body: createDieBody(),
    hitWall: false,
  },
];

dice.forEach((d, i) => {
  scene.add(d.mesh);
  world.addBody(d.body);
  hoverDie(d.body, i);
});

// Register per-frame animation hooks for animated die types (Volatile, Pyre, Doom, Debt, Snake Eyes)
setupDieAnimations(dice[0].mesh, startingSlots[0]?.typeId || 'house_bones');
setupDieAnimations(dice[1].mesh, startingSlots[1]?.typeId || 'house_bones');

const lastBounce = [0, 0];
dice.forEach((d, i) => {
  d.body.addEventListener('collide', (e) => {
    if (e.body === wallBody) d.hitWall = true;
    const now = Date.now();
    if (now - lastBounce[i] > 300) {
      lastBounce[i] = now;
      audio.playBounce();
    }
  });
});

const ui = new UI(game, rogueRun);
const rogueUI = new RogueUI(rogueRun, ui, shopSystem, NPC_DEFS);

// ==== CALLBACKS ====
rogueUI.onShopDone = () => {
  // Shop sequence complete — sync everything
  ui.sync();
  rogueUI.sync();
};
rogueUI.onNewRun = () => {
  /**
   * New-run callback: resets the roguelite run, clears the pot, syncs dice hand,
   * then enters MAP_NAV state so the player can choose their first floor node.
   * The game loop will detect MAP_NAV and call rogueUI.showMap().
   */
  const bonuses = meta.getBonuses();
  rogueRun.resetRun(bonuses);
  pot.clear();
  const newSlots = rogueRun.diceHandSlots;
  dice.forEach((d, i) => {
    d.hitWall = false;
    if (newSlots[i]) {
      updateDieType(d.mesh, newSlots[i].typeId, newSlots[i].durability);
      // Re-register animation hooks for the new die type
      unregisterDieAnimation(d.mesh);
      setupDieAnimations(d.mesh, newSlots[i].typeId);
    }
    hoverDie(d.body, i);
  });
  ui.sync();
  ui.updateTableProgress(game.money, rogueRun.getCurrentTarget(), rogueRun.isBossTable);
  ui.updateBonusPanel(rogueRun.getActiveUpgradeList());
  rogueUI.sync();
  // Start map navigation — game loop will show map overlay
  rogueRun.startMap();
};
rogueUI.sync();
ui.updateTableProgress(game.money, rogueRun.getCurrentTarget(), rogueRun.isBossTable);
ui.updateBonusPanel(rogueRun.getActiveUpgradeList());
let settleCount = 0;
let resultPending = false;
let rollStartTime = 0;
let hoverBob = 0;

// ==== AIM ASSIST ====
const raycaster = new THREE.Raycaster();
let isAiming = false;
let aimTarget = null;

const aimLineMat = new THREE.LineDashedMaterial({
  color: 0xffd700,
  dashSize: 0.12,
  gapSize: 0.08,
  transparent: true,
  opacity: 0.7,
});
const aimLinePositions = new Float32Array(6);
const aimLineGeo = new THREE.BufferGeometry();
aimLineGeo.setAttribute('position', new THREE.BufferAttribute(aimLinePositions, 3));
const aimLine = new THREE.Line(aimLineGeo, aimLineMat);
aimLine.visible = false;
scene.add(aimLine);

function makeTargetSprite() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,215,0,0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.lineTo(32, 26);
  ctx.moveTo(32, 38);
  ctx.lineTo(32, 60);
  ctx.moveTo(4, 32);
  ctx.lineTo(26, 32);
  ctx.moveTo(38, 32);
  ctx.lineTo(60, 32);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(32, 32, 10, 0, Math.PI * 2);
  ctx.stroke();
  return new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthTest: false,
    }),
  );
}
const targetSprite = makeTargetSprite();
targetSprite.scale.set(0.5, 0.5, 1);
targetSprite.visible = false;
scene.add(targetSprite);

function getAimPoint(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);
  const hits = raycaster.intersectObjects(aimTargets);
  if (hits.length > 0) return hits[0].point;
  return null;
}

function updateAimVisual() {
  if (!aimTarget) return;

  aimLinePositions[0] = 0;
  aimLinePositions[1] = HOVER_Y;
  aimLinePositions[2] = HOVER_Z;
  aimLinePositions[3] = aimTarget.x;
  aimLinePositions[4] = aimTarget.y;
  aimLinePositions[5] = aimTarget.z;
  aimLine.geometry.attributes.position.needsUpdate = true;
  aimLine.geometry.computeBoundingSphere();
  aimLine.computeLineDistances();

  targetSprite.position.copy(aimTarget);

  const dx = aimTarget.x;
  const dz = aimTarget.z - HOVER_Z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  ui.setPower(Math.min(dist / 18, 1));
}

function hideAimVisual() {
  aimLine.visible = false;
  targetSprite.visible = false;
  ui.hidePower();
}

// ==== THROW LOGIC ====
function aimThrow() {
  if (!aimTarget) return;
  if (!rogueRun.canRoll || rogueRun.runState !== 'BETTING') return;
  const dx = aimTarget.x;
  const dz = aimTarget.z - HOVER_Z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.3) return;

  const dirX = dx / dist;
  const dirZ = dz / dist;
  const speed = THREE.MathUtils.clamp(dist * 1.2, 0.3, 16);
  const vy = 1 + dist * 0.5;

  if (!rogueRun.roll()) return;
  pot.setBet(game.bet);
  audio.playRoll();

  dice.forEach((d, i) => {
    d.hitWall = false;
    const side = i === 0 ? -DICE_OFFSET : DICE_OFFSET;
    d.body.position.set(side, HOVER_Y, HOVER_Z);
    launchDie(d.body, dirX * speed + (i === 0 ? -0.3 : 0.3), vy, dirZ * speed);
  });

  settleCount = 0;
  resultPending = false;
  rollStartTime = Date.now();
  hideAimVisual();
  ui.sync();
}

// ==== INPUT HANDLERS ====
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  if (!rogueRun.canRoll || rogueRun.runState !== 'BETTING') return;

  dice.forEach((d, i) => {
    if (d.body.position.y < 0.5) hoverDie(d.body, i);
  });

  isAiming = true;
  controls.enabled = false;
  renderer.domElement.style.cursor = 'crosshair';
  const p = getAimPoint(e);
  if (p) aimTarget = p;
  aimLine.visible = true;
  targetSprite.visible = true;
  updateAimVisual();
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!isAiming) return;
  const p = getAimPoint(e);
  if (!p) return;
  aimTarget = p;
  updateAimVisual();
});

renderer.domElement.addEventListener('pointerup', () => {
  if (!isAiming) return;
  isAiming = false;
  controls.enabled = true;
  renderer.domElement.style.cursor = 'default';
  aimThrow();
});

renderer.domElement.addEventListener('pointerleave', () => {
  if (!isAiming) return;
  isAiming = false;
  controls.enabled = true;
  renderer.domElement.style.cursor = 'default';
  hideAimVisual();
});

function forwardThrow() {
  if (!rogueRun.canRoll || rogueRun.runState !== 'BETTING') return;
  if (!rogueRun.roll()) return;
  pot.setBet(game.bet);
  audio.playRoll();

  dice.forEach((d, i) => {
    d.hitWall = false;
    const side = i === 0 ? -DICE_OFFSET : DICE_OFFSET;
    d.body.position.set(side, HOVER_Y, HOVER_Z);
    launchDie(d.body, i === 0 ? -0.3 : 0.3, 5, -8);
  });

  settleCount = 0;
  resultPending = false;
  rollStartTime = Date.now();
  ui.sync();
}

let lastTime = 0;
// ==== GAME LOOP ====
function animate(time) {
  requestAnimationFrame(animate);

  const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
  lastTime = time;

  world.step(1 / 60, 1 / 60, 3);

  dice.forEach((d) => {
    d.mesh.position.copy(d.body.position);
    d.mesh.quaternion.copy(d.body.quaternion);
  });

  pot.sync();

  // Per-frame dice animation updates (Volatile pulse, Pyre particles, Doom wobble, Debt jitter, Snake Eyes pulse)
  updateAllDiceAnimations(dt);

  // ========== MAP NAVIGATION ==========================
  // When the run enters MAP_NAV state (after table clear or run start),
  // show the map overlay so the player can choose their next floor node.
  // Only renders once per state entry; _mapVisible flag prevents re-render.
  if (rogueRun.runState === 'MAP_NAV' && Date.now() >= rogueRun._mapNavBlockedUntil) {
    if (!rogueUI._mapVisible) {
      const mapData = rogueRun.startMap();
      rogueUI.showMap(mapData.actIndex, mapData.floorIndex, mapData.nodes, [
        ...rogueRun.visitedNodes,
      ]);
    }
    // Keep dice hovering during map (same as idle hover)
    hoverBob += 0.04;
    positionDiceHover(dice, hoverBob);
  } else if (rogueRun.runState === 'TABLE_START_LOCK') {
    if (!rogueUI._tableLockMode) {
      rogueUI.showTableStartLock();
    }
    // Keep dice hovering during table-lock selection
    hoverBob += 0.04;
    positionDiceHover(dice, hoverBob);
  } else if (isAiming) {
    positionDiceHover(dice);
  } else if (!game.rolling && !rogueRun.isBust && !resultPending) {
    hoverBob += 0.04;
    positionDiceHover(dice, hoverBob);
  }

  if (game.rolling && !resultPending) {
    const elapsed = Date.now() - rollStartTime;
    const almostStill =
      elapsed > SETTLE_TIMEOUT &&
      dice.every((d) => d.body.velocity.length() < 0.3 && d.body.angularVelocity.length() < 0.3);
    if (almostStill) {
      dice.forEach((d) => {
        d.body.velocity.set(0, 0, 0);
        d.body.angularVelocity.set(0, 0, 0);
      });
      settleCount = SETTLE_FRAMES;
    }

    const allSettled = dice.every((d) => isSettled(d.body));
    if (allSettled) {
      settleCount++;
      if (settleCount >= SETTLE_FRAMES) {
        settleCount = 0;
        resultPending = true;

        const allHitWall = dice.every((d) => d.hitWall);
        if (!allHitWall) {
          game.deadThrow();
          rogueRun.runState = 'BETTING';
          pot.clear();
          audio.playBounce();
          ui.showAnnouncement(callDead(), 'dead');
          ui.sync();
          rogueUI.sync();
        } else {
          const values = dice.map((d) => getTopFace(d.mesh));
          const [d1, d2] = values;
          const sum = d1 + d2;
          const currentPoint = game.point;
          const moneyBefore = game.money;

          const result = rogueRun.resolve(values);
          const announcerText = callAnnouncement(d1, d2, sum, result, currentPoint);
          const netChange = game.money - moneyBefore;

          if (result === 'win') {
            audio.playWin();
            pot.clear();
          } else if (result === 'loss') {
            audio.playLose();
            pot.clear();
          } else if (result === 'push') {
            audio.playSettle();
            pot.clear();
          } else if (result === 'point') {
            audio.playSettle();
          } else {
            audio.playSettle();
          }

          UI.flashScreen(result);
          ui.showAnnouncement(announcerText, result);

          const resolveData = { result, netChange };

          setTimeout(() => {
            const basePayout = result === 'win' ? game.bet * 2 : result === 'push' ? game.bet : 0;
            ui.showResultCard(resolveData.result, game.bet, basePayout, [], resolveData.netChange);

            setTimeout(() => {
              ui.sync();
              ui.updateTableProgress(game.money, rogueRun.getCurrentTarget(), rogueRun.isBossTable);
              ui.updateBonusPanel(rogueRun.getActiveUpgradeList());
              rogueUI.sync();

              if (rogueRun.runState === 'PICKING') {
                rogueUI.showPick();
              } else if (rogueRun.runState === 'BUST') {
                rogueUI.showBust();
              } else if (rogueRun.runState === 'RUN_WON') {
                rogueUI.showRunWon();
              }
            }, 2800);
          }, 400);
        }

        dice.forEach((d, i) => {
          d.hitWall = false;
          hoverDie(d.body, i);
        });
        resultPending = false;
      }
    } else {
      settleCount = 0;
    }
  }

  if (isAiming && aimTarget) updateAimVisual();

  controls.update();
  composer.render();
}

// ==== KEYBOARD SHORTCUTS ====
document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    if (!rogueRun.canRoll || rogueRun.runState !== 'BETTING') return;
    e.preventDefault();
    forwardThrow();
  }
  if (rogueRun.runState !== 'BETTING') return;
  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
    e.preventDefault();
    const idx = BET_CHIPS.indexOf(game.bet);
    if (idx < BET_CHIPS.length - 1) {
      game.setBet(BET_CHIPS[idx + 1]);
      ui.sync();
    }
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
    e.preventDefault();
    const idx = BET_CHIPS.indexOf(game.bet);
    if (idx > 0) {
      game.setBet(BET_CHIPS[idx - 1]);
      ui.sync();
    }
  }
});

// ==== BOOTSTRAP ====
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
