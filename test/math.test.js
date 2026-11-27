import test from 'node:test';
import assert from 'node:assert/strict';
import { quatFromYXZ, quatToYXZ, quatMultVec, poseMult, identityQuat, angularVelocity } from '../src/math.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('YXZ euler round trip', () => {
  for (const [y, p, r] of [[0.3, -0.4, 0.2], [-2.5, 1.2, -3.0], [0, 0, 0], [1.0, 0, 0]]) {
    const [y2, p2, r2] = quatToYXZ(quatFromYXZ(y, p, r));
    near(y2, y);
    near(p2, p);
    near(r2, r);
  }
});

test('positive yaw turns -Z (forward) towards -X (left)', () => {
  const v = quatMultVec(quatFromYXZ(Math.PI / 2, 0, 0), { x: 0, y: 0, z: -1 });
  near(v.x, -1);
  near(v.z, 0);
});

test('positive pitch looks up', () => {
  const v = quatMultVec(quatFromYXZ(0, Math.PI / 2, 0), { x: 0, y: 0, z: -1 });
  near(v.y, 1);
});

test('poseMult places a controller relative to the head', () => {
  const head = { orientation: quatFromYXZ(Math.PI, 0, 0), position: { x: 0, y: 1.7, z: 1 } };
  const rel = { orientation: identityQuat(), position: { x: 0.3, y: -0.3, z: -0.4 } };
  const p = poseMult(head, rel).position;
  near(p.x, -0.3);
  near(p.y, 1.4);
  near(p.z, 1.4);
});

test('angular velocity of a yaw rotation', () => {
  const w = angularVelocity(identityQuat(), quatFromYXZ(0.1, 0, 0), 0.1);
  near(w.y, 1, 1e-9);
  near(w.x, 0);
});
