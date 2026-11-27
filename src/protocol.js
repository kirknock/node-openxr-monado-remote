// Binary layout of Monado's remote driver packet (r_remote_data), see remote-mndset structs.h.
// All fields are little-endian; floats are 32-bit, bools are single bytes.

import { identityQuat } from './math.js';

export const PACKET_SIZE = 376;
export const HEAD_OFFSET = 8;
export const HEAD_CENTER_OFFSET = HEAD_OFFSET + 96;
export const HEAD_PER_VIEW_VALID_OFFSET = HEAD_OFFSET + 124;
export const LEFT_OFFSET = 136;
export const RIGHT_OFFSET = 256;
export const CONTROLLER_SIZE = 120;

/** Offsets inside r_remote_controller_data */
export const C = {
  pose: 0,
  linearVelocity: 28,
  angularVelocity: 40,
  handCurl: 52,
  trigger: 72,
  squeeze: 76,
  squeezeForce: 80,
  thumbstick: 84,
  trackpadForce: 92,
  trackpad: 96,
  // bools
  handTrackingActive: 104,
  active: 105,
  systemClick: 106,
  systemTouch: 107,
  aClick: 108,
  aTouch: 109,
  bClick: 110,
  bTouch: 111,
  triggerClick: 112,
  triggerTouch: 113,
  thumbstickClick: 114,
  thumbstickTouch: 115,
  trackpadTouch: 116,
};

const BOOL_FIELDS = [
  'handTrackingActive', 'active', 'systemClick', 'systemTouch', 'aClick', 'aTouch', 'bClick', 'bTouch',
  'triggerClick', 'triggerTouch', 'thumbstickClick', 'thumbstickTouch', 'trackpadTouch',
];

/** @returns {import('./types.js').ControllerData} */
export function createController() {
  return {
    pose: { orientation: identityQuat(), position: { x: 0, y: 0, z: 0 } },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    handCurl: [0, 0, 0, 0, 0],
    trigger: 0,
    squeeze: 0,
    squeezeForce: 0,
    thumbstick: { x: 0, y: 0 },
    trackpadForce: 0,
    trackpad: { x: 0, y: 0 },
    handTrackingActive: false,
    active: false,
    systemClick: false,
    systemTouch: false,
    aClick: false,
    aTouch: false,
    bClick: false,
    bTouch: false,
    triggerClick: false,
    triggerTouch: false,
    thumbstickClick: false,
    thumbstickTouch: false,
    trackpadTouch: false,
  };
}

/** @returns {import('./types.js').RemoteData} */
export function createRemoteData() {
  return {
    head: {
      center: { orientation: identityQuat(), position: { x: 0, y: 0, z: 0 } },
      perViewDataValid: false,
    },
    left: createController(),
    right: createController(),
  };
}

/** 8-byte header: ASCII string padded with zeros (e.g. "mndrmt3\0"). */
export function headerBytes(header) {
  const b = Buffer.alloc(8);
  b.write(header.slice(0, 8), 0, 'latin1');
  return b;
}

function writePose(buf, off, pose) {
  const { orientation: q, position: p } = pose;
  buf.writeFloatLE(q.x, off);
  buf.writeFloatLE(q.y, off + 4);
  buf.writeFloatLE(q.z, off + 8);
  buf.writeFloatLE(q.w, off + 12);
  buf.writeFloatLE(p.x, off + 16);
  buf.writeFloatLE(p.y, off + 20);
  buf.writeFloatLE(p.z, off + 24);
}

function readPose(buf, off) {
  return {
    orientation: {
      x: buf.readFloatLE(off), y: buf.readFloatLE(off + 4), z: buf.readFloatLE(off + 8), w: buf.readFloatLE(off + 12),
    },
    position: { x: buf.readFloatLE(off + 16), y: buf.readFloatLE(off + 20), z: buf.readFloatLE(off + 24) },
  };
}

const writeVec3 = (buf, off, v) => {
  buf.writeFloatLE(v.x, off);
  buf.writeFloatLE(v.y, off + 4);
  buf.writeFloatLE(v.z, off + 8);
};
const readVec3 = (buf, off) => ({ x: buf.readFloatLE(off), y: buf.readFloatLE(off + 4), z: buf.readFloatLE(off + 8) });

function writeController(buf, base, c) {
  writePose(buf, base + C.pose, c.pose);
  writeVec3(buf, base + C.linearVelocity, c.linearVelocity);
  writeVec3(buf, base + C.angularVelocity, c.angularVelocity);
  c.handCurl.forEach((v, i) => buf.writeFloatLE(v, base + C.handCurl + i * 4));
  buf.writeFloatLE(c.trigger, base + C.trigger);
  buf.writeFloatLE(c.squeeze, base + C.squeeze);
  buf.writeFloatLE(c.squeezeForce, base + C.squeezeForce);
  buf.writeFloatLE(c.thumbstick.x, base + C.thumbstick);
  buf.writeFloatLE(c.thumbstick.y, base + C.thumbstick + 4);
  buf.writeFloatLE(c.trackpadForce, base + C.trackpadForce);
  buf.writeFloatLE(c.trackpad.x, base + C.trackpad);
  buf.writeFloatLE(c.trackpad.y, base + C.trackpad + 4);
  for (const f of BOOL_FIELDS) buf.writeUInt8(c[f] ? 1 : 0, base + C[f]);
}

function readController(buf, base) {
  const c = createController();
  c.pose = readPose(buf, base + C.pose);
  c.linearVelocity = readVec3(buf, base + C.linearVelocity);
  c.angularVelocity = readVec3(buf, base + C.angularVelocity);
  c.handCurl = [0, 1, 2, 3, 4].map((i) => buf.readFloatLE(base + C.handCurl + i * 4));
  c.trigger = buf.readFloatLE(base + C.trigger);
  c.squeeze = buf.readFloatLE(base + C.squeeze);
  c.squeezeForce = buf.readFloatLE(base + C.squeezeForce);
  c.thumbstick = { x: buf.readFloatLE(base + C.thumbstick), y: buf.readFloatLE(base + C.thumbstick + 4) };
  c.trackpadForce = buf.readFloatLE(base + C.trackpadForce);
  c.trackpad = { x: buf.readFloatLE(base + C.trackpad), y: buf.readFloatLE(base + C.trackpad + 4) };
  for (const f of BOOL_FIELDS) c[f] = buf.readUInt8(base + C[f]) !== 0;
  return c;
}

/**
 * Serialize to the 376-byte packet expected by Monado's remote driver.
 * @param {import('./types.js').RemoteData} data
 * @param {Buffer} header 8-byte header from headerBytes()
 * @param {Buffer} [out] reusable output buffer
 */
export function encode(data, header, out = Buffer.alloc(PACKET_SIZE)) {
  out.fill(0);
  header.copy(out, 0, 0, 8);
  // views[2] are left zeroed: per_view_data_valid = false, Monado derives the views itself
  writePose(out, HEAD_CENTER_OFFSET, data.head.center);
  out.writeUInt8(data.head.perViewDataValid ? 1 : 0, HEAD_PER_VIEW_VALID_OFFSET);
  writeController(out, LEFT_OFFSET, data.left);
  writeController(out, RIGHT_OFFSET, data.right);
  return out;
}

/** Inverse of encode(), used by tests and the mock Monado server. @param {Buffer} buf */
export function decode(buf) {
  return {
    header: buf.subarray(0, 8).toString('latin1').replace(/\0+$/, ''),
    head: {
      center: readPose(buf, HEAD_CENTER_OFFSET),
      perViewDataValid: buf.readUInt8(HEAD_PER_VIEW_VALID_OFFSET) !== 0,
    },
    left: readController(buf, LEFT_OFFSET),
    right: readController(buf, RIGHT_OFFSET),
  };
}
