// ============================================================
// physics.js — Cannon-es Physics World + Dice Kinematics
// ============================================================
//
// Thin wrapper around cannon-es that provides everything needed
// for dice physics: world setup (gravity, ground plane, back wall),
// per-die body creation, launch / hover helpers, and settle detection.
//
// Settle detection algorithm:
//   Every frame, each die body's linear and angular velocity are
//   compared against V_THRESHOLD (0.08). When BOTH are below the
//   threshold, a settle counter starts. If the counter reaches
//   SETTLE_FRAMES (50  ≈ 0.83 s @ 60 fps) the dice are considered
//   settled. A hard timeout of SETTLE_TIMEOUT (3000 ms) acts as
//   a safety net — if 3 s pass and both velocities are < 0.3,
//   velocities are forced to zero and the roll is resolved anyway.

import * as CANNON from 'cannon-es';

// ========== CONSTANTS ==========

/**
 * Velocity threshold for settle detection (linear + angular).
 *
 * If both |linear velocity| and |angular velocity| are below this
 * value for 50 consecutive frames, the dice are considered settled.
 *
 * @see isSettled
 * @constant {number}
 */
const V_THRESHOLD = 0.08;

// ========== MATERIALS ==========

/** Shared physics material for all die bodies. */
const dieMat = new CANNON.Material('die');

// ========== WORLD CREATION ==========

/**
 * Build the cannon-es physics world with gravity, ground plane,
 * and back wall.
 *
 * Configures contact materials for die↔ground and die↔die
 * interactions (friction / restitution tuned for realistic
 * craps-table behaviour).
 *
 * @returns {{ world: CANNON.World, groundBody: CANNON.Body, wallBody: CANNON.Body, dieMat: CANNON.Material, groundMat: CANNON.Material }}
 */
export function createWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, -25, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = 10;

  const groundMat = new CANNON.Material('ground');

  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMat, groundMat, {
      friction: 0.4,
      restitution: 0.35,
    }),
  );

  world.addContactMaterial(
    new CANNON.ContactMaterial(dieMat, dieMat, {
      friction: 0.3,
      restitution: 0.25,
    }),
  );

  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({ mass: 0, material: groundMat });
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(groundBody);

  const wallShape = new CANNON.Box(new CANNON.Vec3(7, 4, 0.25));
  const wallBody = new CANNON.Body({ mass: 0, material: groundMat });
  wallBody.addShape(wallShape);
  wallBody.position.set(0, 4, -5);
  world.addBody(wallBody);

  return { world, groundBody, wallBody, dieMat, groundMat };
}

// ========== DIE BODY ==========

/**
 * Create a single die physics body (1×1×1 box, mass 1).
 *
 * Damping values are tuned for dice-like behaviour:
 * quick deceleration without excessive floatiness.
 *
 * @returns {CANNON.Body} a new die body with box shape and die material.
 */
export function createDieBody() {
  const body = new CANNON.Body({ mass: 1, material: dieMat });
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)));
  body.linearDamping = 0.08;
  body.angularDamping = 0.15;
  body.sleepSpeedLimit = 0.05;
  return body;
}

// ========== SETTLE DETECTION ==========

/**
 * Check whether a die body has come to rest.
 *
 * A body is "settled" when both its linear velocity and angular
 * velocity magnitudes are below `V_THRESHOLD` (0.08).
 *
 * Called every frame from the game loop. The caller is responsible
 * for counting consecutive settled frames and applying the timeout.
 *
 * @param {CANNON.Body} body — the die body to test.
 * @returns {boolean} `true` if the body is effectively at rest.
 */
export function isSettled(body) {
  return body.velocity.length() < V_THRESHOLD && body.angularVelocity.length() < V_THRESHOLD;
}

// ========== DIE MOVEMENT HELPERS ==========

/**
 * Position a die body in its pre-roll "hover" position above the table.
 *
 * Die 0 hovers at (−0.75, 3, 1.5); die 1 at (+0.75, 3, 1.5).
 * Both are given a random initial orientation so they tumble
 * differently each roll. All velocities are zeroed.
 *
 * @param {CANNON.Body} body  — the die body to position.
 * @param {number}      index — 0 for left die, 1 for right die.
 */
export function hoverDie(body, index) {
  const x = index === 0 ? -0.75 : 0.75;
  body.position.set(x, 3, 1.5);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.quaternion.setFromEuler(
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
    Math.random() * Math.PI * 2,
  );
}

/**
 * Launch a die body toward the back wall with the given velocity.
 *
 * Adds random angular velocity (±17.5 rad/s on each axis) so the
 * dice tumble unpredictably. Calls `body.wakeUp()` to ensure the
 * body is active even if it was sleeping.
 *
 * @param {CANNON.Body} body — the die body to launch.
 * @param {number} vx — x-component of linear velocity.
 * @param {number} vy — y-component of linear velocity.
 * @param {number} vz — z-component of linear velocity.
 */
export function launchDie(body, vx, vy, vz) {
  body.velocity.set(vx, vy, vz);
  body.angularVelocity.set(
    (Math.random() - 0.5) * 35,
    (Math.random() - 0.5) * 35,
    (Math.random() - 0.5) * 35,
  );
  body.wakeUp();
}
