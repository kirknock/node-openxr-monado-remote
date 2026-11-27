// Port of remote-mndset movement.cpp. Instead of SDL key events, it is driven by named actions
// that are held down (pressed) or released from the web page.

import { quatFromYXZ, quatToYXZ, quatMultVec, vecAdd } from './math.js';

/**
 * Action -> [modifier, value]. Signs follow movement.cpp key bindings:
 * W walk=-1, S walk=+1, A sidestep=-1, D sidestep=+1, Space altitude=+1, LCtrl altitude=-1,
 * Q roll=+1, E roll=-1; mouse X/Y map to yaw=-x / pitch=-y.
 */
export const ACTIONS = {
  forward: ['walk', -1],
  back: ['walk', 1],
  left: ['sidestep', -1],
  right: ['sidestep', 1],
  up: ['altitude', 1],
  down: ['altitude', -1],
  yawLeft: ['yaw', 1],
  yawRight: ['yaw', -1],
  pitchUp: ['pitch', 1],
  pitchDown: ['pitch', -1],
  rollLeft: ['roll', 1],
  rollRight: ['roll', -1],
};

export class Movement {
  constructor() {
    this.linVel = 0.001; // metres per ms at modifier 1
    this.angVel = 0.001; // radians per ms at modifier 1
    this.rotationSpeed = 1.0; // extra factor for yaw/pitch (replaces mouse sensitivity)
    /** @type {Set<string>} */
    this.held = new Set();
  }

  /** Same units as remote-mndset sliders (0..10). */
  updateConfig(linVel, angVel, rotationSpeed) {
    this.linVel = linVel / 1000;
    this.angVel = angVel / 1000;
    this.rotationSpeed = rotationSpeed;
  }

  setAction(action, pressed) {
    if (!(action in ACTIONS)) return false;
    if (pressed) this.held.add(action);
    else this.held.delete(action);
    return true;
  }

  releaseAll() {
    this.held.clear();
  }

  /** Current modifiers in [-1, 1] summed from held actions (opposite buttons cancel out). */
  modifiers() {
    const m = { walk: 0, sidestep: 0, altitude: 0, pitch: 0, yaw: 0, roll: 0 };
    for (const a of this.held) {
      const [key, v] = ACTIONS[a];
      m[key] += v;
    }
    m.yaw *= this.rotationSpeed;
    m.pitch *= this.rotationSpeed;
    return m;
  }

  /**
   * Integrate one frame into pose (mutates it).
   * @param {import('./math.js').Pose} pose
   * @param {number} dtMs frame duration in milliseconds
   * @param {boolean} translate false when walk/sidestep are routed to a thumbstick
   */
  updatePose(pose, dtMs, translate = true) {
    const m = this.modifiers();
    let [yaw, pitch, roll] = quatToYXZ(pose.orientation);
    yaw += m.yaw * this.angVel * dtMs;
    pitch += m.pitch * this.angVel * dtMs;
    roll += m.roll * this.angVel * dtMs;
    pose.orientation = quatFromYXZ(yaw, pitch, roll);

    if (translate) {
      const delta = quatMultVec(pose.orientation, {
        x: m.sidestep * this.linVel * dtMs,
        y: m.altitude * this.linVel * dtMs,
        z: m.walk * this.linVel * dtMs,
      });
      pose.position = vecAdd(pose.position, delta);
    }
  }

  /** Thumbstick value used when this movement is routed to a controller stick. */
  stickValue() {
    const m = this.modifiers();
    return { x: clamp(m.sidestep), y: clamp(-m.walk) };
  }
}

const clamp = (v) => Math.max(-1, Math.min(1, v));
