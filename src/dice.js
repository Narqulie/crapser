import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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

const FACE_VALUES = [1, 6, 2, 5, 3, 4];

export function createDie() {
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

  return mesh;
}

const FACE_DATA = [
  { value: 1, normal: new THREE.Vector3(1, 0, 0) },
  { value: 6, normal: new THREE.Vector3(-1, 0, 0) },
  { value: 2, normal: new THREE.Vector3(0, 1, 0) },
  { value: 5, normal: new THREE.Vector3(0, -1, 0) },
  { value: 3, normal: new THREE.Vector3(0, 0, 1) },
  { value: 4, normal: new THREE.Vector3(0, 0, -1) },
];

const UP = new THREE.Vector3(0, 1, 0);

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
