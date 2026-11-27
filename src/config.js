// Configuration: config/default.json (shipped with the package) merged with user overrides in a per-user
// settings file (port of remote-mndset settings.cpp). Environment variables and CLI options override both.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
export const DEFAULT_FILE = path.join(PACKAGE_ROOT, 'config', 'default.json');
/** Command and settings folder name; fixed so it does not follow the scoped npm package name. */
export const APP_NAME = 'nodexr-monado-web-remote';

/** Same locations as remote-mndset: %APPDATA%\<name> on Windows, $XDG_CONFIG_HOME or ~/.config/<name> elsewhere. */
export function configDir() {
  if (process.platform === 'win32' && process.env.APPDATA) return path.join(process.env.APPDATA, APP_NAME);
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME);
}

export const defaultSettingsFile = () => process.env.SETTINGS_FILE || path.join(configDir(), 'settings.json');

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source || {})) {
    out[k] = isObject(v) && isObject(target[k]) ? deepMerge(target[k], v) : v;
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`Cannot read ${file}: ${err.message}`);
    return {};
  }
}

/**
 * @param {object} [overrides]
 * @param {string} [overrides.settingsFile]
 * @param {string} [overrides.httpHost]
 * @param {number} [overrides.httpPort]
 * @param {string} [overrides.monadoHost]
 * @param {number} [overrides.monadoPort]
 * @param {boolean} [overrides.connect] connect to Monado on start
 */
export function loadConfig(overrides = {}) {
  const settingsFile = overrides.settingsFile || defaultSettingsFile();
  const cfg = deepMerge(readJson(DEFAULT_FILE), readJson(settingsFile));
  cfg.settingsFile = settingsFile;
  const env = process.env;
  cfg.http.host = overrides.httpHost ?? env.HTTP_HOST ?? cfg.http.host;
  cfg.http.port = Number(overrides.httpPort ?? env.HTTP_PORT ?? cfg.http.port);
  cfg.monado.host = overrides.monadoHost ?? env.MONADO_HOST ?? cfg.monado.host;
  cfg.monado.port = Number(overrides.monadoPort ?? env.MONADO_PORT ?? cfg.monado.port);
  if (overrides.connect) cfg.monado.autoConnect = true;
  return cfg;
}

/** Persist only the user-editable parts (connection target and movement speeds). */
export function saveSettings(cfg) {
  const settings = {
    monado: { host: cfg.monado.host, port: cfg.monado.port, autoReconnect: cfg.monado.autoReconnect },
    movement: cfg.movement,
  };
  try {
    fs.mkdirSync(path.dirname(cfg.settingsFile), { recursive: true });
    fs.writeFileSync(cfg.settingsFile, JSON.stringify(settings, null, 2) + '\n');
  } catch (err) {
    console.warn(`Cannot save settings to ${cfg.settingsFile}: ${err.message}`);
  }
}
