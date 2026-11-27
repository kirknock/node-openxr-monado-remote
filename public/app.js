// Control page: hold-to-press buttons that replace remote-mndset's keyboard / mouse bindings.

const PANELS = [
  { id: 'hmd', title: 'HMD', mod: '', note: 'no modifier' },
  { id: 'left', title: 'Left controller', mod: 'LShift+', note: 'LShift' },
  { id: 'right', title: 'Right controller', mod: 'LAlt+', note: 'LAlt' },
];

// [action, label, original key]; null = empty grid cell
const MOVE_PAD = [
  null, ['forward', 'Forward', 'W'], null,
  ['left', 'Left', 'A'], null, ['right', 'Right', 'D'],
  null, ['back', 'Back', 'S'], null,
];
const MOVE_ROW = [['up', 'Up', 'Space'], ['down', 'Down', 'Ctrl']];
const ROT_PAD = [
  null, ['pitchUp', 'Pitch up', 'Mouse ↑'], null,
  ['yawLeft', 'Yaw left', 'Mouse ←'], null, ['yawRight', 'Yaw right', 'Mouse →'],
  null, ['pitchDown', 'Pitch down', 'Mouse ↓'], null,
];
const ROT_ROW = [['rollLeft', 'Roll left', 'Q'], ['rollRight', 'Roll right', 'E']];

// [button, label, original binding (per hand)]
const CTRL_BUTTONS = [
  ['trigger', 'Trigger', { left: 'LMB', right: 'RMB' }],
  ['squeeze', 'Squeeze / Grip', null],
  ['a', 'A / X', { left: 'LShift+Mouse 4', right: 'LAlt+Mouse 4' }],
  ['b', 'B / Y', { left: 'LShift+Mouse 5', right: 'LAlt+Mouse 5' }],
  ['system', 'Menu / System', null],
  ['stickClick', 'Stick click', null],
];
const STICK_PAD = [
  null, ['stickUp', '▲', 'stick up'], null,
  ['stickLeft', '◀', 'stick left'], null, ['stickRight', '▶', 'stick right'],
  null, ['stickDown', '▼', 'stick down'], null,
];

const SLIDERS = [
  ['hmdLinVel', 'HMD linear velocity', 0, 10, 0.1],
  ['hmdAngVel', 'HMD angular velocity', 0, 10, 0.1],
  ['controllerLinVel', 'Controllers linear velocity', 0, 10, 0.1],
  ['controllerAngVel', 'Controllers angular velocity', 0, 10, 0.1],
  ['rotationSpeed', 'Yaw / pitch button speed (mouse sensitivity)', 0, 5, 0.05],
];

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const c of children) if (c != null) e.append(c);
  return e;
};

/** key -> {el, msg} for every hold button */
const buttons = new Map();
/** keys currently pressed by this page */
const localPressed = new Set();
let ws;
let state = null;

// ---------------------------------------------------------------- WebSocket

function connectWs() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    $('#wsWarn').hidden = true;
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') render(msg);
  };
  ws.onclose = () => {
    $('#wsWarn').hidden = false;
    localPressed.clear();
    setTimeout(connectWs, 1000);
  };
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ---------------------------------------------------------------- Hold buttons

function press(key, pressed) {
  const b = buttons.get(key);
  if (!b) return;
  if (pressed === localPressed.has(key)) return;
  if (pressed) localPressed.add(key);
  else localPressed.delete(key);
  b.el.classList.toggle('active', pressed);
  send({ ...b.msg, pressed });
}

function holdButton(key, msg, label, hint) {
  const b = el('button', { className: 'hold', type: 'button' }, el('span', { textContent: label }),
    hint ? el('span', { className: 'k', textContent: hint }) : null);
  b.dataset.key = key;
  buttons.set(key, { el: b, msg, label });

  const latched = () => $('#latch').checked || b.closest('.card')?.querySelector('.latch input')?.checked;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (latched()) {
      press(key, !localPressed.has(key));
      return;
    }
    press(key, true);
    try {
      b.setPointerCapture(e.pointerId); // keep receiving pointerup even if the finger slides off
    } catch {
      // pointer already gone
    }
  });
  const up = () => {
    if (!latched()) press(key, false);
  };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  return b;
}

function grid(className, items, make) {
  return el('div', { className }, ...items.map((it) => (it ? make(it) : el('div', { className: 'spacer' }))));
}

function buildPanels() {
  const root = $('#panels');
  for (const p of PANELS) {
    const move = ([action, label, key]) =>
      holdButton(`${p.id}:${action}`, { type: 'input', target: p.id, action }, label, p.mod + key);

    const card = el('section', { className: `card ${p.id}` },
      el('h2', {}, p.title, el('small', { textContent: `(${p.note})` }),
        el('label', { className: 'check latch' }, el('input', { type: 'checkbox' }), 'latch')),
      el('div', { className: 'cluster' }, el('h3', { textContent: 'Move' }),
        grid('pad', MOVE_PAD, move), el('div', { className: 'row', style: 'margin-top:6px' }, ...MOVE_ROW.map(move))),
      el('div', { className: 'cluster' }, el('h3', { textContent: 'Rotate' }),
        grid('pad', ROT_PAD, move), el('div', { className: 'row', style: 'margin-top:6px' }, ...ROT_ROW.map(move))),
    );

    if (p.id !== 'hmd') {
      const btn = ([button, label, keys]) =>
        holdButton(`${p.id}:${button}`, { type: 'button', hand: p.id, button }, label, keys ? keys[p.id] : '');
      card.append(
        el('div', { className: 'cluster' }, el('h3', { textContent: 'Buttons' }), grid('row', CTRL_BUTTONS, btn)),
        el('div', { className: 'cluster' }, el('h3', { textContent: 'Thumbstick' }), grid('pad', STICK_PAD, btn)),
      );
    }
    card.append(el('pre', { className: 'readout', id: `readout-${p.id}` }));
    root.append(card);
  }
}

// ---------------------------------------------------------------- Top bar & settings

function buildControls() {
  $('#connectBtn').addEventListener('click', () => {
    const c = state?.connection;
    if (c && (c.state !== 'disconnected' || c.wanted)) send({ type: 'disconnect' });
    else send({ type: 'connect', host: $('#host').value, port: Number($('#port').value), autoReconnect: $('#autoReconnect').checked });
  });
  for (const b of document.querySelectorAll('#stickMode button')) {
    b.addEventListener('click', () => send({ type: 'stickMode', mode: b.dataset.mode }));
  }
  $('#resetBtn').addEventListener('click', () => send({ type: 'reset' }));
  $('#releaseAll').addEventListener('click', releaseAllLocal);
  $('#latch').addEventListener('change', () => !$('#latch').checked && releaseAllLocal());

  let timer;
  const pending = {};
  for (const [key, label, min, max, step] of SLIDERS) {
    const input = el('input', { type: 'range', min, max, step, id: `s-${key}` });
    const out = el('output', { id: `o-${key}` });
    input.addEventListener('input', () => {
      out.textContent = Number(input.value).toFixed(2);
      pending[key] = Number(input.value);
      clearTimeout(timer);
      timer = setTimeout(() => {
        send({ type: 'settings', values: { ...pending } });
        for (const k of Object.keys(pending)) delete pending[k];
      }, 150);
    });
    $('#sliders').append(el('label', {}, el('span', { textContent: label }), out, input));
  }
}

function releaseAllLocal() {
  for (const key of [...localPressed]) press(key, false);
  send({ type: 'releaseAll' });
}

// ---------------------------------------------------------------- Rendering

const fmt = (v) => (v >= 0 ? ' ' : '') + v.toFixed(3);
const fmtA = (v) => v.toFixed(1).padStart(6);

function poseText(p) {
  return `pos  x${fmt(p.position.x)}  y${fmt(p.position.y)}  z${fmt(p.position.z)}\n` +
    `rot  yaw${fmtA(p.yaw)}°  pitch${fmtA(p.pitch)}°  roll${fmtA(p.roll)}°`;
}

function render(s) {
  state = s;
  const c = s.connection;
  $('#led').className = `led ${c.state}`;
  $('#connText').textContent = c.state === 'connected'
    ? `connected to ${c.host}:${c.port} — ${c.framesSent} frames sent${c.framesDropped ? `, ${c.framesDropped} dropped` : ''}`
    : c.state === 'connecting' || c.wanted
      ? `connecting to ${c.host}:${c.port}…${c.error ? ` (${c.error})` : ''}`
      : `disconnected${c.error ? ` (${c.error})` : ''}`;
  $('#connectBtn').textContent = c.state === 'disconnected' && !c.wanted ? 'Connect' : 'Disconnect';

  for (const [id, v] of [['host', s.target.host], ['port', s.target.port]]) {
    const input = $(`#${id}`);
    if (document.activeElement !== input && !input.dataset.touched) input.value = v;
  }
  $('#autoReconnect').checked = s.target.autoReconnect;

  for (const b of document.querySelectorAll('#stickMode button')) b.classList.toggle('on', b.dataset.mode === s.stickMode);
  $('#stickHint').textContent = s.stickMode === 'off'
    ? 'HMD Forward/Back/Left/Right move the head in the room.'
    : `HMD Forward/Back/Left/Right drive the ${s.stickMode} controller thumbstick (artificial locomotion); the head does not translate.`;
  for (const a of ['forward', 'back', 'left', 'right']) {
    buttons.get(`hmd:${a}`)?.el.querySelector('.k')
      ?.replaceChildren(s.stickMode === 'off' ? { forward: 'W', back: 'S', left: 'A', right: 'D' }[a] : `→ ${s.stickMode} stick`);
  }

  const held = new Set(s.held);
  for (const [key, b] of buttons) {
    b.el.classList.toggle('active', localPressed.has(key) || held.has(key));
    b.el.classList.toggle('remote', held.has(key) && !localPressed.has(key));
  }

  $('#readout-hmd').textContent = poseText(s.head);
  for (const hand of ['left', 'right']) {
    const h = s[hand];
    const pressedList = ['trigger', 'squeeze', 'a', 'b', 'system', 'stickClick'].filter((k) => (typeof h[k] === 'number' ? h[k] > 0 : h[k]));
    $(`#readout-${hand}`).textContent = `${poseText(h)}\n` +
      `stick x${fmt(h.thumbstick.x)}  y${fmt(h.thumbstick.y)}\n` +
      `pressed: ${pressedList.join(', ') || '—'}`;
  }

  for (const [key] of SLIDERS) {
    const input = $(`#s-${key}`);
    if (document.activeElement !== input) {
      input.value = s.movement[key];
      $(`#o-${key}`).textContent = Number(s.movement[key]).toFixed(2);
    }
  }
}

// ---------------------------------------------------------------- Init

buildPanels();
buildControls();
for (const id of ['host', 'port']) $(`#${id}`).addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
// Never leave a held (non-latched) input stuck when the page loses focus
window.addEventListener('blur', () => {
  if ($('#latch').checked) return;
  for (const key of [...localPressed]) {
    if (!buttons.get(key).el.closest('.card')?.querySelector('.latch input')?.checked) press(key, false);
  }
});
connectWs();
