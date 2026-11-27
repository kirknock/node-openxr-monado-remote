#!/usr/bin/env node
// Stand-in for monado-service with the remote driver: accepts the TCP stream and prints decoded frames.
// Usage: nodexr-monado-mock [port]   (default: MONADO_PORT or 4242)

import net from 'node:net';
import { decode, PACKET_SIZE } from '../src/protocol.js';
import { quatToYXZ } from '../src/math.js';

const port = Number(process.argv[2] || process.env.MONADO_PORT || 4242);
const deg = (r) => ((r * 180) / Math.PI).toFixed(1);
const pose = (p) => {
  const [y, pi, r] = quatToYXZ(p.orientation);
  const { x, y: py, z } = p.position;
  return `(${x.toFixed(2)}, ${py.toFixed(2)}, ${z.toFixed(2)}) ypr ${deg(y)}/${deg(pi)}/${deg(r)}`;
};
const buttons = (c) => [
  c.trigger > 0 && 'trigger', c.squeeze > 0 && 'squeeze', c.aClick && 'A', c.bClick && 'B',
  c.systemClick && 'system', c.thumbstickClick && 'stick',
  (c.thumbstick.x || c.thumbstick.y) && `stick(${c.thumbstick.x},${c.thumbstick.y})`,
].filter(Boolean).join(' ') || '-';

net.createServer((sock) => {
  console.log(`client connected from ${sock.remoteAddress}:${sock.remotePort}`);
  let pending = Buffer.alloc(0);
  let frames = 0;
  let last = '';
  sock.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= PACKET_SIZE) {
      const d = decode(pending.subarray(0, PACKET_SIZE));
      pending = pending.subarray(PACKET_SIZE);
      frames++;
      const line = `head ${pose(d.head.center)} | L ${pose(d.left.pose)} [${buttons(d.left)}] | R ${pose(d.right.pose)} [${buttons(d.right)}]`;
      if (line !== last || frames % 300 === 0) {
        console.log(`#${frames} ${d.header} ${line}`);
        last = line;
      }
    }
  });
  sock.on('close', () => console.log(`client disconnected after ${frames} frames`));
  sock.on('error', () => {});
}).listen(port, '127.0.0.1', () => console.log(`mock Monado remote listening on 127.0.0.1:${port}`));
