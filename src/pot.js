// ============================================================
// pot.js — Cosmetic Money Pile (Physics-Simulated)
// ============================================================
//
// THIS MODULE IS PURELY COSMETIC. It renders a physics-simulated
// pile of bills and coins that sits on the table — it does NOT
// affect game logic, payouts, or the player's money balance.
//
// When the player places a bet, `setBet(amount)` breaks the amount
// into the fewest possible bills (using greedy denomination
// decomposition) plus $1 coins for remainders, then spawns each
// item above the pile position with random scatter. Cannon-es
// bodies let them tumble and stack naturally.
//
// Denomination breakdown:
//   $100 — dark goldenrod bill
//   $50  — purple bill
//   $20  — orange bill
//   $10  — blue bill
//   $5   — green bill
//   $1   — gold coin (remainders; Cylinder mesh)
//
// A floating label sprite above the pile shows the total bet.
// Bill textures are rendered once per denomination on off-screen
// canvases and cached for reuse.

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ========== CONSTANTS ==========

/**
 * Bill denominations in descending order (greedy decomposition).
 * @constant {number[]}
 */
const BILL_DENOMS = [100, 50, 20, 10, 5];

/**
 * CSS colour per denomination used for bill texture backgrounds.
 * @constant {Object<number, string>}
 */
const BILL_COLORS = {
  100: '#b8860b',
  50:  '#7a4a8a',
  20:  '#c97d3a',
  10:  '#4a7cb5',
  5:   '#4a7c59',
};

// ========== DIMENSIONS ==========

/** Bill mesh dimensions (width × thickness × height). */
const BILL_W = 2.8;
const BILL_H = 1.2;
const BILL_T = 0.08;

/** Coin mesh dimensions (radius, height). */
const COIN_R = 0.5;
const COIN_H = 0.1;

// ========== PLACEMENT ==========

/** Y-coordinate where items are spawned (above the pile). */
const SPAWN_Y = 3.5;

/** Center X of the pile on the table. */
const PILE_X = -9;

/** Center Z of the pile on the table. */
const PILE_Z = 0;

/** Max random scatter radius (bills). Coins use 60 % of this. */
const SCATTER = 5.0;

// ========== SHARED GEOMETRY (cached) ==========

let _billGeo;
let _coinGeo;

/** @returns {THREE.BoxGeometry} */
function getBillGeo() {
  if (!_billGeo) _billGeo = new THREE.BoxGeometry(BILL_W, BILL_T, BILL_H);
  return _billGeo;
}

/** @returns {THREE.CylinderGeometry} */
function getCoinGeo() {
  if (!_coinGeo) _coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 12);
  return _coinGeo;
}

// ========== TEXTURE GENERATION ==========

/**
 * Render a bill texture on an off-screen canvas.
 *
 * Each denomination gets its own colour and a large "$XX" label.
 * Textures are cached on the Pot instance so they're only drawn
 * once per denomination.
 *
 * @param {number} denom — bill denomination (5, 10, 20, 50, or 100).
 * @returns {THREE.CanvasTexture}
 */
function makeBillTexture(denom) {
  const c = document.createElement('canvas');
  c.width = 200;
  c.height = 100;
  const ctx = c.getContext('2d');
  const bg = BILL_COLORS[denom] || '#666';
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(6, 6, 188, 88, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(12, 12, 176, 76, 5);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px "SF Mono","Courier New",monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`$${denom}`, 100, 48);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(denom >= 50 ? 'GOLD' : (denom >= 20 ? 'BIG' : 'CASH'), 100, 82);
  return new THREE.CanvasTexture(c);
}

// ========== MATERIAL ==========

/** Shared cannon-es material for all pot bodies (bills + coins). */
const potMat = new CANNON.Material('pot');

// ============================================================
// Pot — physics-driven cosmetic bet pile
// ============================================================
export class Pot {
  /**
   * Create the money pile.
   *
   * @param {THREE.Scene}     scene      — Three.js scene to add meshes to.
   * @param {CANNON.World}    world      — cannon-es world for physics bodies.
   * @param {CANNON.Body}     groundBody — the ground plane body (for contact mats).
   * @param {CANNON.Material} dieMat     — die material (for die↔pot contacts).
   */
  constructor(scene, world, groundBody, dieMat) {
    /** @type {THREE.Group} */
    this.group = new THREE.Group();
    scene.add(this.group);
    this.world = world;

    // Contact materials: pot↔pot, pot↔ground, die↔pot
    world.addContactMaterial(new CANNON.ContactMaterial(potMat, potMat, {
      friction: 0.3, restitution: 0.05,
    }));
    const groundMat = groundBody.material;
    world.addContactMaterial(new CANNON.ContactMaterial(potMat, groundMat, {
      friction: 0.5, restitution: 0.05,
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(dieMat, potMat, {
      friction: 0.5, restitution: 0.05,
    }));

    /** @type {{mesh: THREE.Mesh, body: CANNON.Body}[]} */
    this.bills = [];
    /** @type {{mesh: THREE.Mesh, body: CANNON.Body}[]} */
    this.coins = [];
    /** @type {number} */
    this.amount = 0;

    /** @type {THREE.Sprite|null} */
    this.labelSprite = null;

    /** @private @type {Object<number, THREE.CanvasTexture>} */
    this._billTexCache = {};

    // Shared materials (cloned per bill so each can have its own texture)
    this.billMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.0 });
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700, metalness: 0.7, roughness: 0.3,
    });
  }

  // ========== PUBLIC API ==========

  /**
   * Rebuild the pile to represent a new bet amount.
   *
   * Clears all existing bills and coins, decomposes `amount` into
   * physical items using greedy denomination selection, spawns them,
   * and updates the floating dollar-amount label.
   *
   * @param {number} amount — total bet value in dollars.
   */
  setBet(amount) {
    this.clear();
    this.amount = amount;

    let remaining = amount;
    for (const denom of BILL_DENOMS) {
      if (remaining >= denom) {
        const count = Math.floor(remaining / denom);
        remaining -= count * denom;
        for (let i = 0; i < count; i++) this._spawnBill(denom);
      }
    }

    // Remainders become $1 coins
    for (let i = 0; i < remaining; i++) this._spawnCoin();

    this._updateLabel();
  }

  /**
   * Remove all meshes and physics bodies, resetting the pile to empty.
   */
  clear() {
    for (const b of this.bills) {
      this.group.remove(b.mesh);
      this.world.removeBody(b.body);
    }
    for (const c of this.coins) {
      this.group.remove(c.mesh);
      this.world.removeBody(c.body);
    }
    this.bills = [];
    this.coins = [];
    this.amount = 0;
    if (this.labelSprite) this.labelSprite.visible = false;
  }

  /**
   * Sync mesh transforms to their physics bodies.
   *
   * Called every frame from the game loop so the visible pile
   * matches the cannon-es simulation.
   */
  sync() {
    for (const item of [...this.bills, ...this.coins]) {
      item.mesh.position.copy(item.body.position);
      item.mesh.quaternion.copy(item.body.quaternion);
    }
  }

  // ========== PRIVATE SPAWNING ==========

  /**
   * Spawn a single bill of the given denomination.
   *
   * Creates a textured Box mesh + matching cannon-es Box body at a
   * random position within SCATTER radius of PILE_X/PILE_Z, above
   * SPAWN_Y. Bill textures are created once and cached.
   *
   * @private
   * @param {number} denom — denomination (5, 10, 20, 50, 100).
   */
  _spawnBill(denom) {
    if (!this._billTexCache[denom]) this._billTexCache[denom] = makeBillTexture(denom);
    const tex = this._billTexCache[denom];
    const mat = this.billMat.clone();
    mat.map = tex;
    mat.needsUpdate = true;

    const mesh = new THREE.Mesh(getBillGeo(), mat);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * SCATTER;
    const x = PILE_X + Math.cos(angle) * r;
    const z = PILE_Z + Math.sin(angle) * r;
    const yOff = Math.random() * 0.15;
    mesh.position.set(x, SPAWN_Y + yOff, z);
    mesh.rotation.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.4,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const body = new CANNON.Body({
      mass: 0.5, material: potMat,
      linearDamping: 0.5, angularDamping: 0.5,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(BILL_W / 2, BILL_T / 2, BILL_H / 2)));
    body.position.set(x, SPAWN_Y + yOff, z);
    body.quaternion.copy(mesh.quaternion);
    body.sleepSpeedLimit = 0.08;
    this.world.addBody(body);

    this.bills.push({ mesh, body });
  }

  /**
   * Spawn a single $1 coin.
   *
   * Creates a gold Cylinder mesh + matching cannon-es Cylinder body
   * at a random position (tighter scatter than bills).
   *
   * @private
   */
  _spawnCoin() {
    const mesh = new THREE.Mesh(getCoinGeo(), this.coinMat);
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (SCATTER * 0.6);
    const x = PILE_X + Math.cos(angle) * r;
    const z = PILE_Z + Math.sin(angle) * r;
    const yOff = Math.random() * 0.08;
    mesh.position.set(x, SPAWN_Y + 0.05 + yOff, z);
    mesh.rotation.set(
      (Math.random() - 0.5) * 0.3,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.3,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const body = new CANNON.Body({
      mass: 0.5, material: potMat,
      linearDamping: 0.5, angularDamping: 0.5,
    });
    body.addShape(new CANNON.Cylinder(COIN_R, COIN_R, COIN_H, 12));
    body.position.set(x, SPAWN_Y + 0.05 + yOff, z);
    body.quaternion.copy(mesh.quaternion);
    body.sleepSpeedLimit = 0.08;
    this.world.addBody(body);

    this.coins.push({ mesh, body });
  }

  // ========== LABEL ==========

  /**
   * Update the floating "$N" sprite above the pile to match `this.amount`.
   * Creates the label on first call.
   *
   * @private
   */
  _updateLabel() {
    if (!this.labelSprite) this._createLabel();
    const ctx = this._labelCtx;
    const w = 512, h = 128;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(16, 8, w - 32, h - 16, 14);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 72px "SF Mono","Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(`$${this.amount}`, w / 2, h / 2);
    ctx.shadowBlur = 0;
    this._labelTex.needsUpdate = true;
    this.labelSprite.visible = true;
  }

  /**
   * Create the label sprite (off-screen canvas → texture → Sprite).
   *
   * @private
   */
  _createLabel() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    this._labelCtx = canvas.getContext('2d');
    this._labelTex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: this._labelTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(5, 1.2, 1);
    sprite.position.set(PILE_X, 1.2, PILE_Z);
    sprite.renderOrder = 999;
    this.group.add(sprite);
    this.labelSprite = sprite;
    this._updateLabel();
  }
}
