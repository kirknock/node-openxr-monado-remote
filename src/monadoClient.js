// TCP connection to Monado's remote driver (port of remote-mndset data_sender.cpp).

import net from 'node:net';
import { EventEmitter } from 'node:events';

const MAX_PENDING_BYTES = 64 * 1024; // drop frames instead of buffering when Monado is not reading
const RECONNECT_DELAY_MS = 1000;

/** @typedef {'disconnected'|'connecting'|'connected'} ConnState */

export class MonadoClient extends EventEmitter {
  constructor({ autoReconnect = true } = {}) {
    super();
    /** @type {net.Socket|null} */
    this.socket = null;
    /** @type {ConnState} */
    this.state = 'disconnected';
    this.error = null;
    this.host = null;
    this.port = null;
    this.autoReconnect = autoReconnect;
    this.wanted = false; // user asked to be connected
    this.reconnectTimer = null;
    this.framesSent = 0;
    this.framesDropped = 0;
  }

  connect(host, port) {
    this.disconnect(false);
    this.host = host;
    this.port = port;
    this.wanted = true;
    this.#open();
  }

  disconnect(clearWanted = true) {
    if (clearWanted) this.wanted = false;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.on('error', () => {});
      this.socket.destroy();
      this.socket = null;
    }
    if (clearWanted) this.error = null;
    this.#setState('disconnected');
  }

  /** @param {Buffer} buf */
  send(buf) {
    if (this.state !== 'connected' || !this.socket) return false;
    if (this.socket.writableLength > MAX_PENDING_BYTES) {
      this.framesDropped++;
      return false;
    }
    // copy: the caller reuses its buffer every tick
    this.socket.write(Buffer.from(buf));
    this.framesSent++;
    return true;
  }

  status() {
    return {
      state: this.state,
      error: this.error,
      host: this.host,
      port: this.port,
      wanted: this.wanted,
      framesSent: this.framesSent,
      framesDropped: this.framesDropped,
    };
  }

  #open() {
    this.#setState('connecting');
    const socket = net.createConnection({ host: this.host, port: this.port });
    this.socket = socket;
    socket.setNoDelay(true);
    socket.on('connect', () => {
      this.error = null;
      this.framesSent = 0;
      this.framesDropped = 0;
      console.log(`Connected to Monado at ${this.host}:${this.port}`);
      this.#setState('connected');
    });
    socket.on('data', () => {}); // remote driver does not send anything we use
    socket.on('error', (err) => {
      this.error = err.message;
      console.warn(`Monado connection error: ${err.message}`);
    });
    socket.on('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.#setState('disconnected');
      if (this.wanted && this.autoReconnect) {
        this.reconnectTimer = setTimeout(() => this.wanted && this.#open(), RECONNECT_DELAY_MS);
      } else {
        this.wanted = false;
      }
    });
  }

  #setState(s) {
    if (this.state === s) return;
    this.state = s;
    this.emit('status', this.status());
  }
}
