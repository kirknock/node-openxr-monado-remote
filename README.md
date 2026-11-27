# nodexr-monado-web-remote

Web control panel for [Monado](https://monado.dev/)'s **remote driver** — a Node.js port of
[remote-mndset](https://github.com/kwahoo2/remote-mndset). Instead of grabbing keyboard and mouse, every
input combination is an on-screen button you hold (mouse or multi-touch).

The Node server owns the TCP connection to Monado and runs the 60 Hz simulation loop; the browser only sends
press/release events over a WebSocket.

## Install and run

```bash
npm install -g nodexr-monado-web-remote          # or: npm install -g ./nodexr-monado-web-remote-0.3.0.tgz
P_OVERRIDE_ACTIVE_CONFIG=remote monado-service   # Monado with the remote driver
nodexr-monado-web-remote                         # prints the control page URLs
```

Without installing: `npx nodexr-monado-web-remote`.

Open the page, check host/port (default `127.0.0.1:4242`), press **Connect**, start your OpenXR app.

```
nodexr-monado-web-remote [options]
  -H, --host <addr>        address for the web page        (default 0.0.0.0, env HTTP_HOST)
  -p, --port <n>           port for the web page           (default 8080, env HTTP_PORT)
  -m, --monado-host <addr> monado-service address          (env MONADO_HOST)
  -P, --monado-port <n>    monado remote driver port       (env MONADO_PORT)
  -c, --connect            connect to Monado on start
  -s, --settings <file>    settings file
  -v, --version / -h, --help
```

No Monado at hand? `nodexr-monado-mock [port]` starts a fake remote driver (default port 4242) that prints the
decoded frames.

It can also be embedded: `import { startServer } from 'nodexr-monado-web-remote'` returns
`{ config, server, ready, close }`; the packet encoder is available as `nodexr-monado-web-remote/protocol`.

## Development

```bash
npm install
npm start          # same as the CLI, options after --: npm start -- -P 9292
npm run mock
npm test
npm pack           # builds nodexr-monado-web-remote-<version>.tgz (runs the tests first)
```

## Controls

| remote-mndset              | Web page                                          |
|----------------------------|---------------------------------------------------|
| no modifier / LShift / LAlt| **HMD** / **Left controller** / **Right controller** panel |
| W / S / A / D              | Forward / Back / Left / Right                     |
| Space / Ctrl               | Up / Down                                         |
| Q / E                      | Roll left / Roll right                            |
| Mouse X / Y                | Yaw left/right, Pitch up/down                     |
| LMB / RMB                  | Left / Right controller **Trigger**               |
| Mouse side buttons 1 / 2   | **A/X** / **B/Y**                                 |
| Tab                        | **Thumbstick emulation**: Off / Left stick / Right stick |
| —                          | Squeeze, Menu/System, Stick click, 4-way thumbstick pad (extra protocol fields) |

- Controllers follow the head; their own movement is relative to it (as in remote-mndset).
- With thumbstick emulation on, HMD Forward/Back/Left/Right drive that controller's thumbstick instead of moving the head.
- **Latch** (global or per panel) turns buttons into toggles, e.g. to keep a trigger pressed while moving.
- Everything this page holds is released when the page loses focus or closes.

## Configuration

`config/default.json` (shipped with the package) holds defaults. Changes made in the page (host, port,
auto-reconnect, speeds) are saved per user to `~/.config/nodexr-monado-web-remote/settings.json`
(`$XDG_CONFIG_HOME/...` if set, `%APPDATA%\nodexr-monado-web-remote\settings.json` on Windows), or to the file
given with `--settings` / `SETTINGS_FILE`. CLI options override environment variables, which override both files.

The web page listens on all interfaces (`0.0.0.0`) by default so a phone/tablet on your LAN can be used as the
controller — anyone who can reach the port can drive your headset. Use `--host 127.0.0.1` to restrict it to this
machine.

`monado.header` is the 8-byte protocol tag (`mndrmt3`, used by Monado since commit e4931a46). Change it in
`config/default.json` if your Monado build expects a different version.

## Protocol

One little-endian `r_remote_data` packet (376 bytes) is written to the TCP socket every frame — see
`src/protocol.js` for the field offsets. Nothing is read back.

## Layout

```
bin/cli.js           command line entry point
src/server.js        HTTP + WebSocket server, wiring (startServer)
src/config.js        defaults + per-user settings
src/simulator.js     frame loop (port of remote-mndset main.cpp)
src/movement.js      per-device movement (port of movement.cpp)
src/math.js          quaternion / YXZ euler helpers (port of math_helper.cpp)
src/protocol.js      packet encode/decode
src/monadoClient.js  TCP client with auto-reconnect
public/              control page
tools/mock-monado.js fake remote driver for testing
test/                node:test unit tests
```
