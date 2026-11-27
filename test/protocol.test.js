import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PACKET_SIZE, LEFT_OFFSET, RIGHT_OFFSET, HEAD_CENTER_OFFSET, C, createRemoteData, encode, decode, headerBytes,
} from '../src/protocol.js';

test('packet matches sizeof(r_remote_data)', () => {
  assert.equal(PACKET_SIZE, 376);
  assert.equal(RIGHT_OFFSET - LEFT_OFFSET, 120);
  assert.equal(RIGHT_OFFSET + 120, PACKET_SIZE);
  assert.equal(encode(createRemoteData(), headerBytes('mndrmt3')).length, PACKET_SIZE);
});

test('header is "mndrmt3\\0"', () => {
  const buf = encode(createRemoteData(), headerBytes('mndrmt3'));
  assert.deepEqual([...buf.subarray(0, 8)], [...Buffer.from('mndrmt3\0', 'latin1')]);
});

test('fields land at the C struct offsets', () => {
  const d = createRemoteData();
  d.head.center.orientation = { x: 0.1, y: 0.2, z: 0.3, w: 0.9 };
  d.head.center.position = { x: 1, y: 1.7, z: -2 };
  d.left.active = true;
  d.left.trigger = 1;
  d.left.triggerClick = true;
  d.right.aClick = true;
  d.right.thumbstick = { x: 0.5, y: -1 };
  const buf = encode(d, headerBytes('mndrmt3'));

  assert.ok(Math.abs(buf.readFloatLE(HEAD_CENTER_OFFSET + 12) - 0.9) < 1e-6);
  assert.ok(Math.abs(buf.readFloatLE(HEAD_CENTER_OFFSET + 20) - 1.7) < 1e-6);
  assert.equal(buf.readFloatLE(LEFT_OFFSET + C.trigger), 1);
  assert.equal(buf[LEFT_OFFSET + C.active], 1);
  assert.equal(buf[LEFT_OFFSET + C.triggerClick], 1);
  assert.equal(buf[RIGHT_OFFSET + C.aClick], 1);
  assert.equal(buf.readFloatLE(RIGHT_OFFSET + C.thumbstick), 0.5);
  assert.equal(buf.readFloatLE(RIGHT_OFFSET + C.thumbstick + 4), -1);
});

test('decode is the inverse of encode', () => {
  const d = createRemoteData();
  d.right.pose.position = { x: 0.25, y: 1.5, z: -0.5 };
  d.right.bClick = true;
  d.left.squeeze = 1;
  const back = decode(encode(d, headerBytes('mndrmt3')));
  assert.equal(back.header, 'mndrmt3');
  assert.deepEqual(back.right.pose.position, { x: 0.25, y: 1.5, z: -0.5 });
  assert.equal(back.right.bClick, true);
  assert.equal(back.left.squeeze, 1);
});
