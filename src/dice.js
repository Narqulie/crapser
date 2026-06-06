/**
 * dice.js — Three.js die mesh creation, rendering, face detection, and type management
 *
 * Creates 3D die meshes with 12 unique geometry/material combinations across
 * 4 categories (safe, calculated_risk, gambling, build_around). Supports
 * canvas-generated pip textures, per-type material tints, durability tracking,
 * cracked visual effects, and per-frame animation hooks.
 *
 * @module dice
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getDieType as getTypeDef } from './dice-types.js';

// ========== PIP TEXTURE GENERATION =========================================

/**
 * Generate a canvas-based texture with the given number of pips.
 * @param {number} pipCount — number of pips (1-6)
 * @returns {THREE.CanvasTexture}
 */
function createPipTexture(pipCount) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const m = 14;
  const r = 14;
  ctx.fillStyle = '#f8f8f4';
  ctx.beginPath();
  ctx.moveTo(m + r, m);
  ctx.lineTo(size - m - r, m);
  ctx.quadraticCurveTo(size - m, m, size - m, m + r);
  ctx.lineTo(size - m, size - m - r);
  ctx.quadraticCurveTo(size - m, size - m, size - m - r, size - m);
  ctx.lineTo(m + r, size - m);
  ctx.quadraticCurveTo(m, size - m, m, size - m - r);
  ctx.lineTo(m, m + r);
  ctx.quadraticCurveTo(m, m, m + r, m);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const cx = size / 2;
  const cy = size / 2;
  const pr = 17;
  const o = 48;

  const positions = {
    1: [[0, 0]],
    2: [[-o, -o], [o, o]],
    3: [[-o, -o], [0, 0], [o, o]],
    4: [[-o, -o], [o, -o], [-o, o], [o, o]],
    5: [[-o, -o], [o, -o], [0, 0], [-o, o], [o, o]],
    6: [[-o - 14, -o], [o + 14, -o], [-o - 14, 0], [o + 14, 0], [-o - 14, o], [o + 14, o]],
  };

  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = '#1a1a1a';

  for (const [px, py] of positions[pipCount]) {
    ctx.beginPath();
    ctx.arc(cx + px, cy + py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generate a canvas texture for the given text (used for specialty dice).
 * @param {string} text
 * @param {string} fgColor
 * @param {string} bgColor
 * @returns {THREE.CanvasTexture}
 */
function createTextTexture(text, fgColor, bgColor) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = fgColor;
  ctx.font = 'bold 80px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generate a skull texture for the Doom d20.
 * @returns {THREE.CanvasTexture}
 */
function createSkullTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, size, size);

  // Skull shape
  ctx.fillStyle = '#ddd';
  // Cranium
  ctx.beginPath();
  ctx.arc(size / 2, size / 2 - 20, 50, Math.PI, 0);
  ctx.fill();
  // Jaw
  ctx.fillRect(size / 2 - 35, size / 2 - 5, 70, 45);
  // Eyes
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(size / 2 - 18, size / 2 - 15, 12, 0, Math.PI * 2);
  ctx.arc(size / 2 + 18, size / 2 - 15, 12, 0, Math.PI * 2);
  ctx.fill();
  // Nose
  ctx.beginPath();
  ctx.moveTo(size / 2, size / 2 + 5);
  ctx.lineTo(size / 2 - 8, size / 2 + 18);
  ctx.lineTo(size / 2 + 8, size / 2 + 18);
  ctx.closePath();
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generate a snake-eye iris texture.
 * @returns {THREE.CanvasTexture}
 */
function createSnakeEyeTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#003311';
  ctx.fillRect(0, 0, size, size);
  // Iris ring
  ctx.fillStyle = '#00ff88';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 80, 0, Math.PI * 2);
  ctx.fill();
  // Slit pupil
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(size / 2, size / 2, 8, 50, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generate eye iris texture for Witness.
 * @returns {THREE.CanvasTexture}
 */
function createWitnessTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, size, size);
  // Iris
  ctx.fillStyle = '#2b5797';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 70, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 30, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(size / 2 + 15, size / 2 - 15, 10, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generate fire gradient texture for Pyre.
 * @returns {THREE.CanvasTexture}
 */
function createFireGradientTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.2, '#ffff00');
  gradient.addColorStop(0.5, '#ff8800');
  gradient.addColorStop(0.8, '#ff2200');
  gradient.addColorStop(1, '#330000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Generate scratch-mark texture for Vengeance.
 * @returns {THREE.CanvasTexture}
 */
function createScratchTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#d4c5a9';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#3a3020';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const x1 = Math.random() * size;
    const y1 = Math.random() * size;
    const x2 = x1 + (Math.random() - 0.5) * 80;
    const y2 = y1 + (Math.random() - 0.5) * 80;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

/**
 * Face value ordering for the 6 RoundedBoxGeometry materials.
 * @type {number[]}
 */
const FACE_VALUES = [1, 6, 2, 5, 3, 4];

// ========== TYPE TINT DEFINITIONS ==========================================

/** Per-type material configuration */
const TYPE_TINTS = {
  house_bones: { color: 0xf5f0e6, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.7, metalness: 0 },
  witness:     { color: 0xf5f0e6, emissive: 0x224488, emissiveIntensity: 0.1, roughness: 0.15, metalness: 0.6 },
  glass:       { color: 0xaaddff, emissive: 0x44ccff, emissiveIntensity: 0.1, roughness: 0.05, metalness: 0 },
  volatile:    { color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0 },
  cursed_13:   { color: 0x1a0a2e, emissive: 0x220044, emissiveIntensity: 0.15, roughness: 0.2, metalness: 0.1 },
  loaded_set:  { color: 0xcd7f32, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.3, metalness: 0.6 },
  snake_eyes:  { color: 0x00ff88, emissive: 0x003311, emissiveIntensity: 0.08, roughness: 0.25, metalness: 0.1 },
  doom:        { color: 0x333333, emissive: 0xff0000, emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.5 },
  debt:        { color: 0xffd700, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.2, metalness: 0.8 },
  vengeance:   { color: 0xd4c5a9, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.5, metalness: 0.05 },
  pyre:        { color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0 },
  split:       { color: 0x4488ff, emissive: 0x000000, emissiveIntensity: 0, roughness: 0.35, metalness: 0.1 },
};

// ========== CRACKED CONSTANTS ==============================================

const CRACKED_WIRE_COLOR = 0xff3333;
const CRACKED_EMISSIVE = 0x330000;
const CRACKED_EMISSIVE_INTENSITY = 0.15;

// ========== TINT HELPERS ===================================================

function getTint(typeId) {
  return TYPE_TINTS[typeId] || TYPE_TINTS.house_bones;
}

function applyTint(material, tint) {
  if (tint.color !== undefined) material.color.setHex(tint.color);
  if (tint.emissive !== undefined) material.emissive.setHex(tint.emissive);
  if (tint.emissiveIntensity !== undefined) material.emissiveIntensity = tint.emissiveIntensity;
  if (tint.roughness !== undefined) material.roughness = tint.roughness;
  if (tint.metalness !== undefined) material.metalness = tint.metalness;
}

function applyCrackedVisual(mesh) {
  const wireframe = mesh.children.find(c => c.isLineSegments);
  if (wireframe) {
    wireframe.material.color.setHex(CRACKED_WIRE_COLOR);
    wireframe.material.opacity = 1;
  }
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    if (mat.emissive) mat.emissive.setHex(CRACKED_EMISSIVE);
    if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = CRACKED_EMISSIVE_INTENSITY;
  }
}

// ========== FACE NORMALS EXTRACTION ========================================

/**
 * Extract face normals from a BufferGeometry by computing triangle face normals.
 * @param {THREE.BufferGeometry} geo
 * @returns {THREE.Vector3[]}
 */
function extractFaceNormals(geo) {
  const positions = geo.attributes.position;
  const index = geo.index;
  const normals = [];

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i));
      const b = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 1));
      const c = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 2));
      const normal = new THREE.Vector3();
      const ab = b.clone().sub(a);
      const ac = c.clone().sub(a);
      normal.crossVectors(ab, ac).normalize();
      normals.push(normal);
    }
  } else {
    for (let i = 0; i < positions.count; i += 9) {
      const a = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const b = new THREE.Vector3(positions.getX(i + 3), positions.getY(i + 3), positions.getZ(i + 3));
      const c = new THREE.Vector3(positions.getX(i + 6), positions.getY(i + 6), positions.getZ(i + 6));
      const normal = new THREE.Vector3();
      normal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
      normals.push(normal);
    }
  }
  return normals;
}

/**
 * Build face value array for non-cube dice. Maps face index → value (1-6 cyclically).
 * @param {number} faceCount
 * @returns {number[]}
 */
function buildCyclicFaceValues(faceCount) {
  return Array.from({ length: faceCount }, (_, i) => (i % 6) + 1);
}

// ========== PER-TYPE GEOMETRY BUILDERS =====================================

/**
 * Create a standard cube die (used by house_bones, loaded_set, split halves).
 * @param {string} typeId
 * @returns {THREE.Mesh}
 */
function createCubeDie(typeId) {
  const materials = FACE_VALUES.map(v => new THREE.MeshStandardMaterial({
    map: createPipTexture(v),
    roughness: 0.35,
    metalness: 0.05,
  }));

  const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Wireframe edges
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  mesh.add(new THREE.LineSegments(edges, lineMat));

  // Standard cube face normals
  mesh.userData.faceNormals = [
    { normal: new THREE.Vector3(1, 0, 0) },
    { normal: new THREE.Vector3(-1, 0, 0) },
    { normal: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(0, -1, 0) },
    { normal: new THREE.Vector3(0, 0, 1) },
    { normal: new THREE.Vector3(0, 0, -1) },
  ];
  mesh.userData.faceValues = [1, 6, 2, 5, 3, 4];

  // For loaded_set: asymmetric geometry (wider on X, narrower on Z)
  if (typeId === 'loaded_set') {
    mesh.scale.set(1.1, 1, 0.9);
  }

  return mesh;
}

/**
 * Create a sphere die with eye texture (Witness).
 * @returns {THREE.Mesh}
 */
function createWitnessDie() {
  const geo = new THREE.SphereGeometry(0.5, 32, 32);
  // Use only the first 6 "faces" from the sphere (top 6 octant clusters)
  const mat = new THREE.MeshStandardMaterial({
    map: createWitnessTexture(),
    roughness: 0.15,
    metalness: 0.6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Sphere face normals: use spherical coordinates to define regions
  const faceNormals = [];
  const faceValues = [];
  // 6 face regions based on which axis component is largest
  const axes = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
  ];
  for (let i = 0; i < axes.length; i++) {
    faceNormals.push({ normal: axes[i].clone() });
    faceValues.push(i + 1);
  }
  mesh.userData.faceNormals = faceNormals;
  mesh.userData.faceValues = faceValues;

  // Pupil indicator (small sphere on surface)
  const pupilGeo = new THREE.SphereGeometry(0.1, 8, 8);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const pupil = new THREE.Mesh(pupilGeo, pupilMat);
  pupil.position.set(0, 0.4, 0.3);
  mesh.add(pupil);
  mesh.userData._pupil = pupil;

  return mesh;
}

/**
 * Create an icosahedron die (Glass, Volatile, Pyre, Doom, Vengeance).
 * @param {string} typeId
 * @returns {THREE.Mesh}
 */
function createIcosahedronDie(typeId) {
  const geo = new THREE.IcosahedronGeometry(0.5, 1);

  let mat;
  if (typeId === 'glass') {
    mat = new THREE.MeshPhysicalMaterial({
      roughness: 0.1,
      metalness: 0,
      clearcoat: 0.3,
      transmission: 0.6,
      thickness: 0.5,
      ior: 1.5,
    });
    mat.color.setHex(0xaaddff);
  } else {
    mat = new THREE.MeshStandardMaterial({
      roughness: 0.2,
      metalness: typeId === 'doom' ? 0.5 : 0,
    });
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Wireframe
  const edges = new THREE.EdgesGeometry(geo);
  const edgeColor = typeId === 'doom' ? 0xff0000 : typeId === 'volatile' ? 0xff6600 : 0x222222;
  const lineMat = new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.4 });
  mesh.add(new THREE.LineSegments(edges, lineMat));

  // Extract face normals from geometry
  const geoNormals = extractFaceNormals(geo);
  // Deduplicate similar normals to get unique faces (icosahedron detail 1 = 80 faces → 20 unique)
  const uniqueNormals = [];
  for (const n of geoNormals) {
    const key = `${n.x.toFixed(3)},${n.y.toFixed(3)},${n.z.toFixed(3)}`;
    if (!uniqueNormals.find(u => u.key === key)) {
      uniqueNormals.push({ normal: n.clone(), key });
    }
  }
  mesh.userData.faceNormals = uniqueNormals.map(u => ({ normal: u.normal }));
  mesh.userData.faceValues = buildCyclicFaceValues(uniqueNormals.length);

  // Glass auto-cracks: shift tint to red when durability is low
  if (typeId === 'glass') {
    mesh.userData._glassTint = 0;
  }

  // Volatile ember pulse
  if (typeId === 'volatile') {
    mesh.userData._volatilePulse = 0;
    mesh.userData._baseEmissive = 0.5;
  }

  return mesh;
}

/**
 * Create an octahedron die (Cursed 13).
 * @returns {THREE.Mesh}
 */
function createOctahedronDie() {
  const geo = new THREE.OctahedronGeometry(0.5);
  const mat = new THREE.MeshStandardMaterial({
    map: createTextTexture('13', '#8844ff', '#1a0a2e'),
    roughness: 0.2,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x440088, transparent: true, opacity: 0.5 });
  mesh.add(new THREE.LineSegments(edges, lineMat));

  // 8 faces
  mesh.userData.faceNormals = [
    { normal: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(1, 0, 0) },
    { normal: new THREE.Vector3(0, 0, 1) },
    { normal: new THREE.Vector3(-1, 0, 0) },
    { normal: new THREE.Vector3(0, 0, -1) },
    { normal: new THREE.Vector3(0, -1, 0) },
  ];
  mesh.userData.faceValues = [1, 6, 2, 5, 3, 4];

  return mesh;
}

/**
 * Create a tetrahedron die (Snake Eyes - d4 pyramid).
 * @returns {THREE.Mesh}
 */
function createTetrahedronDie() {
  const geo = new THREE.TetrahedronGeometry(0.6);
  const mat = new THREE.MeshStandardMaterial({
    map: createSnakeEyeTexture(),
    roughness: 0.25,
    metalness: 0.1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.5 });
  mesh.add(new THREE.LineSegments(edges, lineMat));

  // 4 faces
  mesh.userData.faceNormals = [
    { normal: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(0.94, -0.33, 0) },
    { normal: new THREE.Vector3(-0.47, -0.33, 0.82) },
    { normal: new THREE.Vector3(-0.47, -0.33, -0.82) },
  ];
  mesh.userData.faceValues = [1, 6, 3, 4];

  // Snake-eye scale pulse on win (handled in animation registry)

  return mesh;
}

/**
 * Create a coin-stack die (Debt).
 * @returns {THREE.Group}
 */
function createDebtDie() {
  const group = new THREE.Group();
  const coinCount = 4;
  const coinRadius = 0.3;
  const coinHeight = 0.08;
  const coinGap = 0.02;

  for (let i = 0; i < coinCount; i++) {
    const coinGeo = new THREE.CylinderGeometry(coinRadius, coinRadius, coinHeight, 32);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.2,
      metalness: 0.8,
      map: createTextTexture('₡1', '#b8860b', '#ffd700'),
    });
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.position.y = i * (coinHeight + coinGap) - (coinCount * (coinHeight + coinGap)) / 2;
    coin.castShadow = true;
    coin.receiveShadow = true;
    group.add(coin);
  }

  // Use 6 directional face normals for value detection
  group.userData.faceNormals = [
    { normal: new THREE.Vector3(1, 0, 0) },
    { normal: new THREE.Vector3(-1, 0, 0) },
    { normal: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(0, -1, 0) },
    { normal: new THREE.Vector3(0, 0, 1) },
    { normal: new THREE.Vector3(0, 0, -1) },
  ];
  group.userData.faceValues = [1, 6, 2, 5, 3, 4];
  group.userData._jitterOffset = Math.random() * Math.PI * 2;

  return group;
}

/**
 * Create a knucklebone-style die (Vengeance — displaced icosahedron).
 * @returns {THREE.Mesh}
 */
function createVengeanceDie() {
  const baseGeo = new THREE.IcosahedronGeometry(0.4, 1);
  const positions = baseGeo.attributes.position;

  // Random vertex displacement for organic irregular look
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z);
    if (len > 0.01) {
      const displacement = 1 + (Math.random() - 0.5) * 0.25;
      positions.setXYZ(i, x * displacement, y * displacement, z * displacement);
    }
  }
  positions.needsUpdate = true;
  baseGeo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xd4c5a9,
    roughness: 0.5,
    metalness: 0.05,
    map: createScratchTexture(),
  });
  const mesh = new THREE.Mesh(baseGeo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edges = new THREE.EdgesGeometry(baseGeo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x5a4030, transparent: true, opacity: 0.3 });
  mesh.add(new THREE.LineSegments(edges, lineMat));

  const geoNormals = extractFaceNormals(baseGeo);
  const uniqueNormals = [];
  for (const n of geoNormals) {
    const key = `${n.x.toFixed(3)},${n.y.toFixed(3)},${n.z.toFixed(3)}`;
    if (!uniqueNormals.find(u => u.key === key)) {
      uniqueNormals.push({ normal: n.clone(), key });
    }
  }
  mesh.userData.faceNormals = uniqueNormals.map(u => ({ normal: u.normal }));
  mesh.userData.faceValues = buildCyclicFaceValues(uniqueNormals.length);
  mesh.userData._vengeanceGlow = 0;

  return mesh;
}

/**
 * Create a fire particle die (Pyre — icosahedron with orbiting embers).
 * @returns {THREE.Mesh}
 */
function createPyreDie() {
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: createFireGradientTexture(),
    roughness: 0.1,
    metalness: 0,
  });
  mat.emissive.setHex(0xff4400);
  mat.emissiveIntensity = 1.2;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Particle ember system
  const particleCount = 10;
  const particles = new THREE.Group();
  for (let i = 0; i < particleCount; i++) {
    const pGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const pMat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xffaa00 : 0xff4400 });
    const particle = new THREE.Mesh(pGeo, pMat);
    const angle = (i / particleCount) * Math.PI * 2;
    particle.position.set(Math.cos(angle) * 0.6, (Math.random() - 0.5) * 0.3, Math.sin(angle) * 0.6);
    particle.userData._angle = angle;
    particle.userData._speed = 0.5 + Math.random() * 1.5;
    particle.userData._radius = 0.5 + Math.random() * 0.3;
    particle.userData._life = Math.random();
    particles.add(particle);
  }
  mesh.add(particles);
  mesh.userData._pyreParticles = particles;
  mesh.userData._pyreTime = 0;

  const geoNormals = extractFaceNormals(geo);
  const uniqueNormals = [];
  for (const n of geoNormals) {
    const key = `${n.x.toFixed(3)},${n.y.toFixed(3)},${n.z.toFixed(3)}`;
    if (!uniqueNormals.find(u => u.key === key)) {
      uniqueNormals.push({ normal: n.clone(), key });
    }
  }
  mesh.userData.faceNormals = uniqueNormals.map(u => ({ normal: u.normal }));
  mesh.userData.faceValues = buildCyclicFaceValues(uniqueNormals.length);

  return mesh;
}

/**
 * Create linked split pair die (two small cubes connected by bar).
 * @returns {THREE.Group}
 */
function createSplitDie() {
  const group = new THREE.Group();

  const halfSize = 0.45;
  const geo = new RoundedBoxGeometry(halfSize, halfSize, halfSize, 2, 0.06);
  const materialsA = FACE_VALUES.map(v => new THREE.MeshStandardMaterial({
    map: createPipTexture(v),
    roughness: 0.35,
    metalness: 0.05,
  }));
  const materialsB = FACE_VALUES.map(v => new THREE.MeshStandardMaterial({
    map: createPipTexture(v),
    roughness: 0.35,
    metalness: 0.05,
  }));

  // Left die (blue tint)
  const leftDie = new THREE.Mesh(geo, materialsA);
  leftDie.position.x = -0.35;
  for (const mat of materialsA) {
    mat.color.setHex(0x4488ff);
    mat.emissive.setHex(0x001133);
    mat.emissiveIntensity = 0.08;
  }
  leftDie.castShadow = true;
  leftDie.receiveShadow = true;
  group.add(leftDie);

  // Right die (red tint)
  const rightDie = new THREE.Mesh(geo, materialsB);
  rightDie.position.x = 0.35;
  for (const mat of materialsB) {
    mat.color.setHex(0xff4444);
    mat.emissive.setHex(0x331111);
    mat.emissiveIntensity = 0.08;
  }
  rightDie.castShadow = true;
  rightDie.receiveShadow = true;
  group.add(rightDie);

  // Connecting bar
  const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8);
  const barMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.7 });
  const bar = new THREE.Mesh(barGeo, barMat);
  bar.rotation.z = Math.PI / 2;
  bar.castShadow = true;
  group.add(bar);

  // Wireframes
  [leftDie, rightDie].forEach(die => {
    const edges = new THREE.EdgesGeometry(die.geometry);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x444444 });
    die.add(new THREE.LineSegments(edges, lineMat));
  });

  // Face normals (same as cube)
  group.userData.faceNormals = [
    { normal: new THREE.Vector3(1, 0, 0) },
    { normal: new THREE.Vector3(-1, 0, 0) },
    { normal: new THREE.Vector3(0, 1, 0) },
    { normal: new THREE.Vector3(0, -1, 0) },
    { normal: new THREE.Vector3(0, 0, 1) },
    { normal: new THREE.Vector3(0, 0, -1) },
  ];
  group.userData.faceValues = [1, 6, 2, 5, 3, 4];
  group.userData._splitLeft = leftDie;
  group.userData._splitRight = rightDie;
  group.userData._splitBar = bar;

  return group;
}

// ========== DIE CREATION FACTORY ===========================================

/**
 * Create a die mesh with type-specific geometry, materials, and visual effects.
 * Routes to the appropriate builder based on typeId.
 *
 * @param {string} [typeId='house_bones'] — die type id from dice-types.js
 * @returns {THREE.Mesh|THREE.Group}
 */
export function createDie(typeId = 'house_bones') {
  let mesh;

  switch (typeId) {
    // Safe — cube
    case 'house_bones':
    case 'loaded_set':
      mesh = createCubeDie(typeId);
      break;

    // Safe — sphere (eye)
    case 'witness':
      mesh = createWitnessDie();
      break;

    // Calculated Risk / Gambling / Build-Around — icosahedron variants
    case 'glass':
    case 'volatile':
    case 'doom':
    case 'pyre':
    case 'vengeance':
      mesh = createIcosahedronDie(typeId);
      break;

    // Calculated Risk — octahedron
    case 'cursed_13':
      mesh = createOctahedronDie();
      break;

    // Gambling — tetrahedron (d4)
    case 'snake_eyes':
      mesh = createTetrahedronDie();
      break;

    // Build-Around — coin stack
    case 'debt':
      mesh = createDebtDie();
      break;

    // Build-Around — linked dice pair
    case 'split':
      mesh = createSplitDie();
      break;

    default:
      mesh = createCubeDie('house_bones');
      break;
  }

  // Assign type metadata and durability
  const typeDef = getTypeDef(typeId);
  mesh.userData.type = typeDef || getTypeDef('house_bones');
  mesh.userData.durability = mesh.userData.type ? mesh.userData.type.durability : 15;

  // Apply per-type visual tint to all materials
  const tint = getTint(typeId);
  const materials = [];
  mesh.traverse(child => {
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!materials.includes(mat)) {
          materials.push(mat);
          applyTint(mat, tint);
        }
      }
    }
  });

  return mesh;
}

// ========== ANIMATION REGISTRY =============================================

/** @type {Array<{mesh: THREE.Object3D, updateFn: (dt: number) => void}>} */
const _animatedDice = [];

/**
 * Register a die mesh for per-frame animation updates.
 * @param {THREE.Object3D} mesh
 * @param {(dt: number) => void} updateFn — receives deltaTime in seconds
 */
export function registerDieAnimation(mesh, updateFn) {
  _animatedDice.push({ mesh, updateFn });
}

/**
 * Unregister a die mesh from animation updates.
 * @param {THREE.Object3D} mesh
 */
export function unregisterDieAnimation(mesh) {
  const idx = _animatedDice.findIndex(e => e.mesh === mesh);
  if (idx !== -1) _animatedDice.splice(idx, 1);
}

/**
 * Update all registered animated dice. Call from the game loop.
 * @param {number} deltaTime — seconds since last frame
 */
export function updateAllDiceAnimations(deltaTime) {
  for (const entry of _animatedDice) {
    try { entry.updateFn(deltaTime); } catch (e) { /* ignore per-die errors */ }
  }
}

/**
 * Get the total number of registered animated dice.
 * @returns {number}
 */
export function getAnimatedDiceCount() {
  return _animatedDice.length;
}

// ========== FACE DETECTION =================================================

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Determine which face value is pointing upward.
 * Uses faceNormals and faceValues stored on the mesh userData.
 * Falls back to cube face data for compatibility.
 *
 * @param {THREE.Object3D} mesh — die mesh or group with quaternion set by physics
 * @returns {number} face value (1-6)
 */
export function getTopFace(mesh) {
  let maxDot = -Infinity;
  let topIdx = 0;
  const quat = mesh.quaternion;

  const faceNormals = mesh.userData.faceNormals;
  if (!faceNormals || faceNormals.length === 0) {
    // Fallback: cube face data
    const FACE_DATA = [
      { normal: new THREE.Vector3(1, 0, 0) },
      { normal: new THREE.Vector3(-1, 0, 0) },
      { normal: new THREE.Vector3(0, 1, 0) },
      { normal: new THREE.Vector3(0, -1, 0) },
      { normal: new THREE.Vector3(0, 0, 1) },
      { normal: new THREE.Vector3(0, 0, -1) },
    ];
    const FACE_VALS = [1, 6, 2, 5, 3, 4];
    for (let i = 0; i < FACE_DATA.length; i++) {
      const worldNormal = FACE_DATA[i].normal.clone().applyQuaternion(quat);
      const dot = worldNormal.dot(UP);
      if (dot > maxDot) {
        maxDot = dot;
        topIdx = i;
      }
    }
    return FACE_VALS[topIdx];
  }

  for (let i = 0; i < faceNormals.length; i++) {
    const worldNormal = faceNormals[i].normal.clone().applyQuaternion(quat);
    const dot = worldNormal.dot(UP);
    if (dot > maxDot) {
      maxDot = dot;
      topIdx = i;
    }
  }

  const faceValues = mesh.userData.faceValues;
  if (faceValues && faceValues[topIdx] !== undefined) {
    return faceValues[topIdx];
  }
  return (topIdx % 6) + 1;
}

// ========== TYPE UPDATE ====================================================

/**
 * Update an existing die mesh to a new type. Updates userData and material tints.
 * Note: does NOT change the geometry — for full geometry change, recreate the die.
 * @param {THREE.Object3D} mesh
 * @param {string} typeId
 * @param {number} [durability] — optional, overrides the type default
 */
export function updateDieType(mesh, typeId, durability) {
  const typeDef = getTypeDef(typeId) || getTypeDef('house_bones');
  mesh.userData.type = typeDef;
  mesh.userData.durability = durability != null ? durability : typeDef.durability;

  const tint = getTint(typeId);
  mesh.traverse(child => {
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        applyTint(mat, tint);
      }
    }
  });

  if (mesh.userData.durability <= 0) {
    applyCrackedVisual(mesh);
  }
}

// ========== DURABILITY & TYPE QUERIES ======================================

/**
 * Decrement a die's durability by 1. Applies cracked visual when it reaches 0.
 * @param {THREE.Object3D} mesh
 * @returns {{ stillGood: boolean, becameCracked: boolean }}
 */
export function consumeDieDurability(mesh) {
  if (mesh.userData.durability == null || mesh.userData.durability <= 0) {
    return { stillGood: false, becameCracked: false };
  }

  mesh.userData.durability -= 1;
  const becameCracked = mesh.userData.durability === 0;

  if (becameCracked) {
    applyCrackedVisual(mesh);
  }

  return { stillGood: mesh.userData.durability > 0, becameCracked };
}

/**
 * Return the die type object stored on the mesh.
 * @param {THREE.Object3D} mesh
 * @returns {object}
 */
export function getDieType(mesh) {
  return mesh.userData.type || getTypeDef('house_bones');
}

/**
 * Check whether a die is cracked (durability ≤ 0).
 * @param {THREE.Object3D} mesh
 * @returns {boolean}
 */
export function isDieCracked(mesh) {
  return mesh.userData.durability != null && mesh.userData.durability <= 0;
}

// ========== ANIMATION UPDATE HOOKS =========================================

/**
 * Create per-frame animation hooks for all animated die types.
 * Call this after creating dice to register their animation callbacks.
 * @param {THREE.Object3D} mesh — die mesh from createDie()
 * @param {string} typeId
 */
export function setupDieAnimations(mesh, typeId) {
  switch (typeId) {
    case 'volatile':
      registerDieAnimation(mesh, (dt) => {
        const base = mesh.userData._baseEmissive || 0.5;
        mesh.userData._volatilePulse = (mesh.userData._volatilePulse || 0) + dt * 3;
        const pulse = base + Math.sin(mesh.userData._volatilePulse) * 0.3;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of materials) {
          if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = pulse;
        }
      });
      break;

    case 'pyre':
      registerDieAnimation(mesh, (dt) => {
        mesh.userData._pyreTime = (mesh.userData._pyreTime || 0) + dt;
        const particles = mesh.userData._pyreParticles;
        if (!particles) return;
        for (const p of particles.children) {
          p.userData._angle += p.userData._speed * dt;
          p.userData._life -= dt * 0.8;
          if (p.userData._life <= 0) {
            p.userData._life = 1;
            p.userData._angle = Math.random() * Math.PI * 2;
            p.userData._speed = 0.5 + Math.random() * 1.5;
            p.userData._radius = 0.5 + Math.random() * 0.3;
          }
          const a = p.userData._angle;
          const r = p.userData._radius;
          const h = Math.sin(mesh.userData._pyreTime * 3 + a) * 0.4;
          p.position.set(Math.cos(a) * r, h, Math.sin(a) * r);
        }
      });
      break;

    case 'doom':
      registerDieAnimation(mesh, (dt) => {
        mesh.rotation.y += 0.1 * dt;
      });
      break;

    case 'debt':
      registerDieAnimation(mesh, (dt) => {
        const offset = mesh.userData._jitterOffset || 0;
        for (const child of mesh.children) {
          if (child.isMesh && child.geometry.type === 'CylinderGeometry') {
            child.rotation.z = Math.sin(Date.now() * 0.003 + offset + child.position.y) * 0.05;
          }
        }
      });
      break;

    case 'snake_eyes':
      // Snake eyes gets a win-pulse (triggered externally via userData flag)
      mesh.userData._snakePulse = 0;
      registerDieAnimation(mesh, (dt) => {
        if (mesh.userData._snakePulse > 0) {
          mesh.userData._snakePulse -= dt * 5;
          const s = 1 + mesh.userData._snakePulse * 0.3;
          mesh.scale.setScalar(Math.max(1, s));
        }
      });
      break;
  }
}
