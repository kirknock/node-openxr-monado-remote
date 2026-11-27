// Port of remote-mndset math_helper.cpp (GLM conventions, OpenXR axes: X+ right, Y+ up, Z+ towards viewer).

/** @typedef {{x:number, y:number, z:number}} Vec3 */
/** @typedef {{x:number, y:number, z:number, w:number}} Quat */
/** @typedef {{orientation: Quat, position: Vec3}} Pose */

export const identityQuat = () => ({ x: 0, y: 0, z: 0, w: 1 });

/** @param {Quat} a @param {Quat} b @returns {Quat} a * b */
export function quatMul(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

/** @param {Quat} q */
export function quatNormalize(q) {
  const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

/**
 * Same as glm::eulerAngleYXZ(yaw, pitch, roll) converted to a quaternion: Ry(yaw) * Rx(pitch) * Rz(roll).
 * Angles in radians.
 * @returns {Quat}
 */
export function quatFromYXZ(yaw, pitch, roll) {
  const qy = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
  const qx = { x: Math.sin(pitch / 2), y: 0, z: 0, w: Math.cos(pitch / 2) };
  const qz = { x: 0, y: 0, z: Math.sin(roll / 2), w: Math.cos(roll / 2) };
  return quatMul(quatMul(qy, qx), qz);
}

/**
 * Same as glm::extractEulerAngleYXZ applied to the rotation matrix of q.
 * @param {Quat} q
 * @returns {[number, number, number]} [yaw, pitch, roll] in radians
 */
export function quatToYXZ(q) {
  const { x, y, z, w } = quatNormalize(q);
  // Row-major rotation matrix r[row][col]
  const r00 = 1 - 2 * (y * y + z * z);
  const r01 = 2 * (x * y - z * w);
  const r02 = 2 * (x * z + y * w);
  const r10 = 2 * (x * y + z * w);
  const r11 = 1 - 2 * (x * x + z * z);
  const r12 = 2 * (y * z - x * w);
  const r20 = 2 * (x * z - y * w);
  const r21 = 2 * (y * z + x * w);
  const r22 = 1 - 2 * (x * x + y * y);

  const yaw = Math.atan2(r02, r22);
  const pitch = Math.atan2(-r12, Math.sqrt(r10 * r10 + r11 * r11));
  const s1 = Math.sin(yaw);
  const c1 = Math.cos(yaw);
  const roll = Math.atan2(s1 * r21 - c1 * r01, c1 * r00 - s1 * r20);
  return [yaw, pitch, roll];
}

/** Rotate vector v by quaternion q. @returns {Vec3} */
export function quatMultVec(q, v) {
  const { x: qx, y: qy, z: qz, w: qw } = q;
  // q * v
  const tw = -qx * v.x - qy * v.y - qz * v.z;
  const tx = qw * v.x + qy * v.z - qz * v.y;
  const ty = qw * v.y + qz * v.x - qx * v.z;
  const tz = qw * v.z + qx * v.y - qy * v.x;
  // (q * v) * q^-1
  return {
    x: tw * -qx + tx * qw + ty * -qz - tz * -qy,
    y: tw * -qy - tx * -qz + ty * qw + tz * -qx,
    z: tw * -qz + tx * -qy - ty * -qx + tz * qw,
  };
}

/** @param {Vec3} a @param {Vec3} b */
export const vecAdd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

/** Compose poses: result = a * b. @param {Pose} a @param {Pose} b @returns {Pose} */
export function poseMult(a, b) {
  return {
    orientation: quatMul(a.orientation, b.orientation),
    position: vecAdd(a.position, quatMultVec(a.orientation, b.position)),
  };
}

/** @param {Pose} p @returns {Pose} */
export const clonePose = (p) => ({ orientation: { ...p.orientation }, position: { ...p.position } });

/**
 * Angular velocity (rad/s) that rotates q1 into q2 over dt seconds.
 * @param {Quat} q1 @param {Quat} q2 @param {number} dt
 * @returns {Vec3}
 */
export function angularVelocity(q1, q2, dt) {
  const inv = { x: -q1.x, y: -q1.y, z: -q1.z, w: q1.w }; // unit quaternion inverse
  let d = quatMul(inv, q2);
  if (d.w < 0) d = { x: -d.x, y: -d.y, z: -d.z, w: -d.w };
  const vLen = Math.hypot(d.x, d.y, d.z);
  const theta = Math.atan2(vLen, d.w);
  if (Math.abs(theta) < 1e-6 || dt <= 0) return { x: 0, y: 0, z: 0 };
  const scale = (2 * theta) / dt;
  return { x: (d.x / vLen) * scale, y: (d.y / vLen) * scale, z: (d.z / vLen) * scale };
}
