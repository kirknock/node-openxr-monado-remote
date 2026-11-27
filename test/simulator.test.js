import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../src/simulator.js';

const fakeClient = { send() {} };
const movement = { hmdLinVel: 1, hmdAngVel: 1, controllerLinVel: 1, controllerAngVel: 1, rotationSpeed: 1 };
const make = () => new Simulator({ client: fakeClient, movement, header: 'mndrmt3', tickHz: 60 });

test('holding forward moves the head along -Z at 1 m/s', () => {
  const sim = make();
  sim.setInput(1, 'hmd', 'forward', true);
  for (let i = 0; i < 100; i++) sim.step(10);
  assert.ok(Math.abs(sim.data.head.center.position.z - 0) < 1e-6); // 1.0 - 1 s * 1 m/s
  sim.setInput(1, 'hmd', 'forward', false);
  sim.step(10);
  assert.ok(Math.abs(sim.data.head.center.position.z) < 1e-6);
});

test('controllers follow the head', () => {
  const sim = make();
  sim.setInput(1, 'hmd', 'up', true);
  for (let i = 0; i < 50; i++) sim.step(10);
  assert.ok(Math.abs(sim.data.left.pose.position.y - (1.7 + 0.5 - 0.3)) < 1e-6);
});

test('thumbstick emulation routes HMD walk into the selected stick', () => {
  const sim = make();
  sim.setStickMode('left');
  sim.setInput(1, 'hmd', 'forward', true);
  sim.step(16);
  assert.deepEqual(sim.data.left.thumbstick, { x: 0, y: 1 });
  assert.equal(sim.data.head.center.position.z, 1);
});

test('buttons are released when their client goes away', () => {
  const sim = make();
  sim.setButton(7, 'right', 'trigger', true);
  sim.setInput(7, 'left', 'yawLeft', true);
  sim.step(16);
  assert.equal(sim.data.right.triggerClick, true);
  assert.equal(sim.data.right.trigger, 1);
  sim.releaseClient(7);
  sim.step(16);
  assert.equal(sim.data.right.triggerClick, false);
  assert.equal(sim.mov.left.held.size, 0);
});
