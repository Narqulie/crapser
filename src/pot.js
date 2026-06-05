import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const BILL_DENOMS = [100, 50, 20, 10, 5];
const BILL_COLORS = {
  100: '#b8860b',
  50: '#7a4a8a',
  20: '#c97d3a',
  10: '#4a7cb5',
  5: '#4a7c59',
};
const BILL_W = 2.8;
const BILL_H = 1.2;
const BILL_T = 0.08;
const SPAWN_Y = 3.5;
const PILE_X = -9;
const PILE_Z = 0;
const SCATTER = 5.0;
const COIN_R = 0.5;
const COIN_H = 0.1;

let _billGeo, _coinGeo;
function getBillGeo() {
  if (!_billGeo) _billGeo = new THREE.BoxGeometry(BILL_W, BILL_T, BILL_H);
  return _billGeo;
}
function getCoinGeo() {
  if (!_coinGeo) _coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 12);
  return _coinGeo;
}

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

const potMat = new CANNON.Material('pot');

export class Pot {
  constructor(scene, world, groundBody, dieMat) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.world = world;

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

    this.bills = [];
    this.coins = [];
    this.amount = 0;
    this.labelSprite = null;
    this._billTexCache = {};

    this.billMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.0 });
    this.coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700, metalness: 0.7, roughness: 0.3,
    });
  }

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

    for (let i = 0; i < remaining; i++) this._spawnCoin();

    this._updateLabel();
  }

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

  sync() {
    for (const item of [...this.bills, ...this.coins]) {
      item.mesh.position.copy(item.body.position);
      item.mesh.quaternion.copy(item.body.quaternion);
    }
  }
}
