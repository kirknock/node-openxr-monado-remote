// HTTP server for the control page + WebSocket API, owns the Monado connection and the frame loop.
// Started by bin/cli.js (or programmatically via startServer()).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { loadConfig, saveSettings } from './config.js';
import { MonadoClient } from './monadoClient.js';
import { Simulator, TARGETS, HANDS, BUTTONS, STICK_MODES } from './simulator.js';
import { ACTIONS } from './movement.js';

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const STATE_INTERVAL_MS = 66; // ~15 Hz UI updates
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

/**
 * Start the HTTP + WebSocket server, the Monado connection and the frame loop.
 * @param {object} [options] overrides, see loadConfig()
 * @returns {{config: object, server: http.Server, ready: Promise<void>, close: () => Promise<void>}}
 */
export function startServer(options = {}) {
  const config = loadConfig(options);
  const client = new MonadoClient({ autoReconnect: config.monado.autoReconnect });
  const sim = new Simulator({
    client,
    movement: config.movement,
    header: config.monado.header,
    tickHz: config.tickHz,
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.resolve(PUBLIC_DIR, rel);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, body) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  let nextClientId = 1;

  function fullState() {
    return {
      type: 'state',
      connection: client.status(),
      target: { host: config.monado.host, port: config.monado.port, autoReconnect: client.autoReconnect },
      movement: config.movement,
      clients: wss.clients.size,
      ...sim.snapshot(),
    };
  }

  function broadcast() {
    if (!wss.clients.size) return;
    const msg = JSON.stringify(fullState());
    for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(msg);
  }

  function handleMessage(id, msg) {
    switch (msg.type) {
      case 'input':
        if (TARGETS.includes(msg.target) && msg.action in ACTIONS) sim.setInput(id, msg.target, msg.action, !!msg.pressed);
        break;
      case 'button':
        if (HANDS.includes(msg.hand) && BUTTONS.includes(msg.button)) sim.setButton(id, msg.hand, msg.button, !!msg.pressed);
        break;
      case 'releaseAll':
        sim.releaseClient(id);
        break;
      case 'stickMode':
        if (STICK_MODES.includes(msg.mode)) sim.setStickMode(msg.mode);
        break;
      case 'connect': {
        const host = String(msg.host || config.monado.host).trim();
        const port = Number(msg.port || config.monado.port);
        if (!host || !Number.isInteger(port) || port < 1 || port > 65535) break;
        config.monado.host = host;
        config.monado.port = port;
        if (typeof msg.autoReconnect === 'boolean') config.monado.autoReconnect = client.autoReconnect = msg.autoReconnect;
        saveSettings(config);
        client.connect(host, port);
        break;
      }
      case 'disconnect':
        client.disconnect();
        break;
      case 'reset':
        sim.reset();
        break;
      case 'settings': {
        for (const [k, v] of Object.entries(msg.values || {})) {
          const n = Number(v);
          if (k in config.movement && Number.isFinite(n) && n >= 0 && n <= 10) config.movement[k] = n;
        }
        sim.applyMovementConfig(config.movement);
        saveSettings(config);
        break;
      }
      default:
        return;
    }
    broadcast();
  }

  wss.on('connection', (ws) => {
    const id = nextClientId++;
    ws.send(JSON.stringify(fullState()));
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      handleMessage(id, msg);
    });
    ws.on('close', () => {
      sim.releaseClient(id); // never leave movement stuck when a page goes away
      broadcast();
    });
  });

  client.on('status', broadcast);

  const stateTimer = setInterval(broadcast, STATE_INTERVAL_MS);
  sim.start();

  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.http.port, config.http.host, () => {
      const { host, port } = config.http;
      const addrs = host === '0.0.0.0'
        ? Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4').map((a) => a.address)
        : [host];
      for (const a of addrs) console.log(`Control page: http://${a}:${port}/`);
      console.log(`Monado target: ${config.monado.host}:${config.monado.port} (header "${config.monado.header}")`);
      console.log(`Settings file: ${config.settingsFile}`);
      if (config.monado.autoConnect) client.connect(config.monado.host, config.monado.port);
      resolve();
    });
  });

  function close() {
    clearInterval(stateTimer);
    sim.stop();
    client.disconnect();
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return { config, server, ready, close };
}
