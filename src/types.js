// JSDoc type definitions shared across modules (for IDE completion only).

/**
 * @typedef {import('./math.js').Pose} Pose
 * @typedef {import('./math.js').Vec3} Vec3
 *
 * @typedef {object} ControllerData
 * @property {Pose} pose
 * @property {Vec3} linearVelocity
 * @property {Vec3} angularVelocity
 * @property {number[]} handCurl
 * @property {number} trigger
 * @property {number} squeeze
 * @property {number} squeezeForce
 * @property {{x:number, y:number}} thumbstick
 * @property {number} trackpadForce
 * @property {{x:number, y:number}} trackpad
 * @property {boolean} handTrackingActive
 * @property {boolean} active
 * @property {boolean} systemClick
 * @property {boolean} systemTouch
 * @property {boolean} aClick
 * @property {boolean} aTouch
 * @property {boolean} bClick
 * @property {boolean} bTouch
 * @property {boolean} triggerClick
 * @property {boolean} triggerTouch
 * @property {boolean} thumbstickClick
 * @property {boolean} thumbstickTouch
 * @property {boolean} trackpadTouch
 *
 * @typedef {object} RemoteData
 * @property {{center: Pose, perViewDataValid: boolean}} head
 * @property {ControllerData} left
 * @property {ControllerData} right
 */

export {};
