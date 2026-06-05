/**
 * dice.js — Three.js die mesh creation, rendering, face detection, and type management
 *
 * Creates 3D die meshes with canvas-generated pip textures and per-type material tints.
 * Provides utilities for reading the top face from world-space quaternion orientation,
 * applying type-based visual tints, updating die types at runtime, and tracking durability
 * with cracked visual effects (red wireframe + emissive bleed).
 *
 * @module dice
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { getDieType as getTypeDef } from './dice-types.js';

// ========== PIP TEXTURE GENERATION =========================================

/**
 * Generate a canvas-based texture with the given number of pips.
 * Draws pip dots using standard die face arrangements (1-6).
 *
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
 * Face value ordering for the 6 materials of the RoundedBoxGeometry.
 * Index 0 maps to face with normal (1,0,0) → value 1, and so on.
 * @type {number[]}
 */
const FACE_VALUES = [1, 6, 2, 5, 3, 4];

// ========== TYPE TINT DEFINITIONS ==========================================

/** Subtle per-type material tint: color multiplier + low emissive glow */
const TYPE_TINTS = {
  standard:    { color: 0xffffff, emissive: 0x000000, emissiveIntensity: 0 },
  weighted:    { color: 0xfff6e0, emissive: 0xffaa00, emissiveIntensity: 0.06 },
  volatile:    { color: 0xfff0f0, emissive: 0xff2222, emissiveIntensity: 0.06 },
  seven_die:   { color: 0xf5f5f5, emissive: 0xcccccc, emissiveIntensity: 0.07 },
  glass:       { color: 0xf0f8ff, emissive: 0x44ccff, emissiveIntensity: 0.07 },
  precision:   { color: 0xfafaff, emissive: 0xeeeeff, emissiveIntensity: 0.05 },
  lucky_11:    { color: 0x00ff88, emissive: 0x003311, emissiveIntensity: 0.07 },
  cursed_13:   { color: 0x880088, emissive: 0x220022, emissiveIntensity: 0.07 },
  mirror:      { color: 0xcccccc, emissive: 0x333333, emissiveIntensity: 0.06 },
  snake_eyes:  { color: 0x00ffff, emissive: 0x003333, emissiveIntensity: 0.07 },
  hustler:     { color: 0xffaa00, emissive: 0x332200, emissiveIntensity: 0.07 },
  loaded_set:  { color: 0xff4444, emissive: 0x331111, emissiveIntensity: 0.07 },
};

/** Cracked-die wireframe color */
const CRACKED_WIRE_COLOR = 0xff3333;

/** Cracked-die emissive bleed (low red) */
const CRACKED_EMISSIVE = 0x330000;
const CRACKED_EMISSIVE_INTENSITY = 0.15;

// ========== TINT HELPERS ==================================================

function getTint(typeId) {
  return TYPE_TINTS[typeId] || TYPE_TINTS.standard;
}

function applyTint(material, tint) {
  material.color.setHex(tint.color);
  material.emissive.setHex(tint.emissive);
  material.emissiveIntensity = tint.emissiveIntensity;
}

function applyCrackedVisual(mesh) {
  const wireframe = mesh.children.find(c => c.isLineSegments);
  if (wireframe) {
    wireframe.material.color.setHex(CRACKED_WIRE_COLOR);
  }
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    mat.emissive.setHex(CRACKED_EMISSIVE);
    mat.emissiveIntensity = CRACKED_EMISSIVE_INTENSITY;
  }
}

// ========== DIE CREATION ==================================================

/**
 * Create a die mesh with optional type assignment.
 * @param {string} [typeId='standard'] — die type id from dice-types.js
 * @returns {THREE.Mesh}
 */
export function createDie(typeId = 'standard') {
  const materials = FACE_VALUES.map(v => new THREE.MeshStandardMaterial({
    map: createPipTexture(v),
    roughness: 0.35,
    metalness: 0.05,
  }));

  const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);

  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x222222 });
  const wireframe = new THREE.LineSegments(edges, lineMat);
  mesh.add(wireframe);

  // Assign type metadata and durability
  const typeDef = getTypeDef(typeId);
  mesh.userData.type = typeDef || getTypeDef('standard');
  mesh.userData.durability = mesh.userData.type.durability;

  // Apply per-type visual tint
  const tint = getTint(typeId);
  for (const mat of materials) {
    applyTint(mat, tint);
  }

  return mesh;
}

/**
 * Face data mapping die face values to their local-space normals.
 * Used by getTopFace() to determine which face is pointing upward by
 * comparing world-space normals against the UP vector.
 * @type {Array<{value: number, normal: THREE.Vector3}>}
 */
const FACE_DATA = [
  { value: 1, normal: new THREE.Vector3(1, 0, 0) },
  { value: 6, normal: new THREE.Vector3(-1, 0, 0) },
  { value: 2, normal: new THREE.Vector3(0, 1, 0) },
  { value: 5, normal: new THREE.Vector3(0, -1, 0) },
  { value: 3, normal: new THREE.Vector3(0, 0, 1) },
  { value: 4, normal: new THREE.Vector3(0, 0, -1) },
];

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Determine which face of a die mesh is pointing upward.
 * Transforms each face normal to world space via the mesh quaternion,
 * then picks the one with the highest dot product against UP.
 *
 * @param {THREE.Mesh} mesh — die mesh with quaternion set by the physics engine
 * @returns {number} the face value (1-6)
 */
export function getTopFace(mesh) {
  let maxDot = -Infinity;
  let topValue = 1;
  const quat = mesh.quaternion;

  for (const { value, normal } of FACE_DATA) {
    const worldNormal = normal.clone().applyQuaternion(quat);
    const dot = worldNormal.dot(UP);
    if (dot > maxDot) {
      maxDot = dot;
      topValue = value;
    }
  }

  return topValue;
}

// ========== TYPE UPDATE ===================================================

/**
 * Update an existing die mesh to a new type. Updates userData and material tints.
 * @param {THREE.Mesh} mesh
 * @param {string} typeId
 * @param {number} [durability] — optional, overrides the type default
 */
export function updateDieType(mesh, typeId, durability) {
  const typeDef = getTypeDef(typeId) || getTypeDef('standard');
  mesh.userData.type = typeDef;
  mesh.userData.durability = durability != null ? durability : typeDef.durability;

  const tint = getTint(typeId);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    applyTint(mat, tint);
  }

  // If durability is 0 (cracked), apply cracked visual
  if (mesh.userData.durability <= 0) {
    applyCrackedVisual(mesh);
  }
}

// ========== DURABILITY & TYPE QUERIES ======================================

/**
 * Decrement a die's durability by 1. Applies cracked visual when it reaches 0.
 * @param {THREE.Mesh} mesh
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
 * @param {THREE.Mesh} mesh
 * @returns {object} die type definition from dice-types.js
 */
export function getDieType(mesh) {
  return mesh.userData.type || getTypeDef('standard');
}

/**
 * Check whether a die is cracked (durability ≤ 0).
 * @param {THREE.Mesh} mesh
 * @returns {boolean}
 */
export function isDieCracked(mesh) {
  return mesh.userData.durability != null && mesh.userData.durability <= 0;
}
