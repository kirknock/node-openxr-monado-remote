// Frame loop: turns held inputs into poses/buttons and streams them to Monado
// (port of the main loop in remote-mndset main.cpp).

import { Movement, ACTIONS } from './movement.js';
import { createRemoteData, encode, headerBytes, PACKET_SIZE } from './protocol.js';
import { identityQuat, poseMult, clonePose, angularVelocity, quatToYXZ } from './math.js';

export const HANDS = ['left', 'right'];
export const TARGETS = ['hmd', 'left', 'right'];
export const STICK_MODES = ['off', 'left', 'right'];
export const BUTTONS = [
  'trigger', 'squeeze', 'a', 'b', 'system', 'stickClick',
  'stickUp', 'stickDown', 'stickLeft', 'stickRight',
];

// Starting poses from main.cpp. X+ right, Y+ up, Z+ towards the camera.
const HEAD_START = { orientation: identityQuat(), position: { x: 0, y: 1.7, z: 1.0 } };
const REL_START = {
  left: { orientation: identityQuat(), position: { x: -0.3, y: -0.3, z: -0.4 } },
  right: { orientation: identityQuat(), position: { x: 0.3, y: -0.3, z: -0.4 } },
};

export class Simulator {
  /**
   * @param {object} opts
   * @param {import('./monadoClient.js').MonadoClient} opts.client
   * @param {object} opts.movement movement section of the config
   * @param {string} opts.header packet header string
   * @param {number} opts.tickHz
   */
  constructor({ client, movement, header, tickHz }) {
    this.client = client;
    this.header = headerBytes(header);
    this.tickMs = 1000 / tickHz;
    this.out = Buffer.alloc(PACKET_SIZE);
    this.mov = { hmd: new Movement(), left: new Movement(), right: new Movement() };
    this.stickMode = 'off';
    /** key "target:action" or "hand:button" -> client ids holding it */
    this.holders = new Map();
    this.applyMovementConfig(movement);
    this.reset();
  }

  applyMovementConfig(m) {
    this.mov.hmd.updateConfig(m.hmdLinVel, m.hmdAngVel, m.rotationSpeed);
    this.mov.left.updateConfig(m.controllerLinVel, m.controllerAngVel, m.rotationSpeed);
    this.mov.right.updateConfig(m.controllerLinVel, m.controllerAngVel, m.rotationSpeed);
  }

  reset() {
    this.data = createRemoteData();
    this.data.head.center = clonePose(HEAD_START);
    this.rel = { left: clonePose(REL_START.left), right: clonePose(REL_START.right) };
    for (const hand of HANDS) {
      this.data[hand].active = true;
      this.data[hand].pose = poseMult(this.data.head.center, this.rel[hand]);
    }
  }

  start() {
    this.last = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - this.last, 100); // avoid jumps after a stall
      this.last = now;
      this.step(dt);
      this.client.send(encode(this.data, this.header, this.out));
    }, this.tickMs);
  }

  stop() {
    clearInterval(this.timer);
  }

  setStickMode(mode) {
    if (STICK_MODES.includes(mode)) this.stickMode = mode;
  }

  /** Movement action (forward, yawLeft, ...) on hmd/left/right. */
  setInput(clientId, target, action, pressed) {
    if (!TARGETS.includes(target) || !(action in ACTIONS)) return;
    const key = `${target}:${action}`;
    this.#hold(key, clientId, pressed);
    this.mov[target].setAction(action, this.holders.has(key));
  }

  /** Controller button (trigger, a, b, ...) on left/right. */
  setButton(clientId, hand, button, pressed) {
    if (!HANDS.includes(hand) || !BUTTONS.includes(button)) return;
    this.#hold(`${hand}:${button}`, clientId, pressed);
  }

  isHeld(key) {
    return this.holders.has(key);
  }

  /** Release everything a client held (e.g. on WebSocket close). */
  releaseClient(clientId) {
    for (const [key, set] of [...this.holders]) {
      if (!set.delete(clientId) || set.size) continue;
      this.holders.delete(key);
      const [target, action] = key.split(':');
      if (TARGETS.includes(target) && action in ACTIONS) this.mov[target].setAction(action, false);
    }
  }

  #hold(key, clientId, pressed) {
    let set = this.holders.get(key);
    if (pressed) {
      if (!set) this.holders.set(key, (set = new Set()));
      set.add(clientId);
    } else if (set) {
      set.delete(clientId);
      if (!set.size) this.holders.delete(key);
    }
  }

  /** Advance the simulation by dtMs milliseconds. */
  step(dtMs) {
    const d = this.data;
    // head; walk/sidestep are routed to a thumbstick when emulation is on
    this.mov.hmd.updatePose(d.head.center, dtMs, this.stickMode === 'off');

    for (const hand of HANDS) {
      const c = d[hand];
      const old = clonePose(c.pose);
      // controllers follow the head, their own movement is relative to it
      this.mov[hand].updatePose(this.rel[hand], dtMs);
      c.pose = poseMult(d.head.center, this.rel[hand]);
      const dt = dtMs / 1000;
      if (dt > 0) {
        c.linearVelocity = {
          x: (c.pose.position.x - old.position.x) / dt,
          y: (c.pose.position.y - old.position.y) / dt,
          z: (c.pose.position.z - old.position.z) / dt,
        };
        c.angularVelocity = angularVelocity(old.orientation, c.pose.orientation, dt);
      }

      const held = (b) => this.isHeld(`${hand}:${b}`);
      c.trigger = held('trigger') ? 1 : 0;
      c.triggerClick = c.triggerTouch = held('trigger');
      c.squeeze = held('squeeze') ? 1 : 0;
      c.aClick = c.aTouch = held('a');
      c.bClick = c.bTouch = held('b');
      c.systemClick = c.systemTouch = held('system');

      let stick = {
        x: (held('stickRight') ? 1 : 0) - (held('stickLeft') ? 1 : 0),
        y: (held('stickUp') ? 1 : 0) - (held('stickDown') ? 1 : 0),
      };
      if (this.stickMode === hand) {
        const emu = this.mov.hmd.stickValue();
        if (emu.x || emu.y) stick = emu;
      }
      c.thumbstick = stick;
      c.thumbstickClick = held('stickClick');
      c.thumbstickTouch = c.thumbstickClick || stick.x !== 0 || stick.y !== 0;
    }
  }

  /** Compact state for the web page. */
  snapshot() {
    const pose = (p) => {
      const [yaw, pitch, roll] = quatToYXZ(p.orientation).map((r) => round((r * 180) / Math.PI, 1));
      const { x, y, z } = p.position;
      return { position: { x: round(x, 3), y: round(y, 3), z: round(z, 3) }, yaw, pitch, roll };
    };
    const ctrl = (c) => ({
      ...pose(c.pose),
      trigger: c.trigger,
      squeeze: c.squeeze,
      a: c.aClick,
      b: c.bClick,
      system: c.systemClick,
      stickClick: c.thumbstickClick,
      thumbstick: c.thumbstick,
    });
    return {
      stickMode: this.stickMode,
      head: pose(this.data.head.center),
      left: ctrl(this.data.left),
      right: ctrl(this.data.right),
      held: [...this.holders.keys()],
    };
  }
}

const round = (v, n) => Math.round(v * 10 ** n) / 10 ** n;
