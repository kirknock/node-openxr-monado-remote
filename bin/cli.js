#!/usr/bin/env node
// Command line entry point: nodexr-monado-web-remote [options]

import { parseArgs } from 'node:util';
import { startServer } from '../src/server.js';
import { PACKAGE_JSON, defaultSettingsFile } from '../src/config.js';

const HELP = `${PACKAGE_JSON.name} ${PACKAGE_JSON.version}
${PACKAGE_JSON.description}

Usage: ${PACKAGE_JSON.name} [options]

Options:
  -H, --host <addr>        address for the web page        (default 0.0.0.0, env HTTP_HOST)
  -p, --port <n>           port for the web page           (default 8080, env HTTP_PORT)
  -m, --monado-host <addr> monado-service address          (env MONADO_HOST)
  -P, --monado-port <n>    monado remote driver port       (env MONADO_PORT)
  -c, --connect            connect to Monado on start
  -s, --settings <file>    settings file                   (default ${defaultSettingsFile()})
  -v, --version            print version
  -h, --help               print this help

Start Monado with the remote driver first:  P_OVERRIDE_ACTIVE_CONFIG=remote monado-service
`;

let args;
try {
  ({ values: args } = parseArgs({
    options: {
      host: { type: 'string', short: 'H' },
      port: { type: 'string', short: 'p' },
      'monado-host': { type: 'string', short: 'm' },
      'monado-port': { type: 'string', short: 'P' },
      connect: { type: 'boolean', short: 'c' },
      settings: { type: 'string', short: 's' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  }));
} catch (err) {
  console.error(`${err.message}\n\n${HELP}`);
  process.exit(2);
}

if (args.help) {
  console.log(HELP);
  process.exit(0);
}
if (args.version) {
  console.log(PACKAGE_JSON.version);
  process.exit(0);
}

const port = (v, name) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    console.error(`Invalid ${name}: ${v}`);
    process.exit(2);
  }
  return n;
};

console.log(`${PACKAGE_JSON.name} ${PACKAGE_JSON.version}`);
const app = startServer({
  httpHost: args.host,
  httpPort: port(args.port, '--port'),
  monadoHost: args['monado-host'],
  monadoPort: port(args['monado-port'], '--monado-port'),
  connect: args.connect,
  settingsFile: args.settings,
});

app.ready.catch((err) => {
  console.error(`Cannot start web server: ${err.message}`);
  process.exit(1);
});

const shutdown = () => {
  app.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
