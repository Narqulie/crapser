import * as CANNON from 'cannon-es';

const V_THRESHOLD = 0.08;

const dieMat = new CANNON.Material('die');

export function createWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, -25, 0);
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;
  world.solver.iterations = 10;

  const groundMat = new CANNON.Material('ground');

  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, groundMat, {
    friction: 0.4,
    restitution: 0.35,
  }));

  world.addContactMaterial(new CANNON.ContactMaterial(dieMat, dieMat, {
    friction: 0.3,
    restitution: 0.25,
  }));

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

export function createDieBody() {
  const body = new CANNON.Body({ mass: 1, material: dieMat });
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)));
  body.linearDamping = 0.08;
  body.angularDamping = 0.15;
  body.sleepSpeedLimit = 0.05;
  return body;
}

export function isSettled(body) {
  return body.velocity.length() < V_THRESHOLD
    && body.angularVelocity.length() < V_THRESHOLD;
}

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

export function launchDie(body, vx, vy, vz) {
  body.velocity.set(vx, vy, vz);
  body.angularVelocity.set(
    (Math.random() - 0.5) * 35,
    (Math.random() - 0.5) * 35,
    (Math.random() - 0.5) * 35,
  );
  body.wakeUp();
}
