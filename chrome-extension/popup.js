'use strict';

let port = null;
let writer = null;
let reader = null;
let readLoopActive = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const dot          = document.getElementById('status-dot');
const connectLabel = document.getElementById('connect-label');
const btnConnect   = document.getElementById('btn-connect');
const btnDisconnect= document.getElementById('btn-disconnect');
const logEl        = document.getElementById('log');

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

// ── Serial connection ─────────────────────────────────────────────────────────
btnConnect.addEventListener('click', async () => {
  if (!navigator.serial) {
    appendLog('ERR: Web Serial API not available. Use Chrome 89+ and a secure context.');
    return;
  }
  try {
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    writer = port.writable.getWriter();
    setConnected(true);
    startReadLoop();
  } catch (err) {
    appendLog('ERR: ' + err.message);
  }
});

btnDisconnect.addEventListener('click', async () => {
  await doDisconnect();
});

async function doDisconnect() {
  readLoopActive = false;
  try { if (reader) { await reader.cancel(); reader.releaseLock(); reader = null; } } catch(_) {}
  try { if (writer) { writer.releaseLock(); writer = null; } } catch(_) {}
  try { if (port)   { await port.close(); port = null; } } catch(_) {}
  setConnected(false);
}

function setConnected(yes) {
  dot.className = 'dot ' + (yes ? 'connected' : 'disconnected');
  connectLabel.textContent = yes ? 'Connected' : 'Not connected';
  btnConnect.classList.toggle('hidden', yes);
  btnDisconnect.classList.toggle('hidden', !yes);
  document.querySelectorAll('button:not(#btn-connect):not(#btn-disconnect)').forEach(b => {
    b.disabled = !yes;
  });
}

// ── Read loop ─────────────────────────────────────────────────────────────────
async function startReadLoop() {
  readLoopActive = true;
  reader = port.readable.getReader();
  const decoder = new TextDecoder();
  try {
    while (readLoopActive) {
      const { value, done } = await reader.read();
      if (done) break;
      appendLog(decoder.decode(value).trim());
    }
  } catch (err) {
    if (readLoopActive) appendLog('ERR: ' + err.message);
  } finally {
    reader.releaseLock();
    reader = null;
  }
}

// ── Send command ──────────────────────────────────────────────────────────────
async function send(cmd) {
  if (!writer) { appendLog('ERR: not connected'); return; }
  try {
    await writer.write(new TextEncoder().encode(cmd + '\n'));
  } catch (err) {
    appendLog('ERR: ' + err.message);
    await doDisconnect();
  }
}

// ── Log ───────────────────────────────────────────────────────────────────────
function appendLog(text) {
  if (!text) return;
  logEl.textContent = text + '\n' + logEl.textContent;
  // keep last 20 lines
  const lines = logEl.textContent.split('\n');
  if (lines.length > 20) logEl.textContent = lines.slice(0, 20).join('\n');
}

// ── Button handlers ───────────────────────────────────────────────────────────
document.getElementById('btn-city').addEventListener('click', () => {
  const v = document.getElementById('city').value.trim();
  if (v) send('CITY=' + v);
});

document.getElementById('btn-mode').addEventListener('click', () => {
  send('MODE=' + document.getElementById('mode').value);
});

document.getElementById('btn-bright').addEventListener('click', () => {
  const v = document.querySelector('input[name="bright"]:checked');
  if (v) send('BRIGHT=' + v.value);
});

document.getElementById('btn-palette').addEventListener('click', () => {
  send('PALETTE=' + document.getElementById('palette').value);
});

document.getElementById('btn-text-save').addEventListener('click', () => {
  const v = document.getElementById('custom-text').value.trim();
  if (v) send('TEXT=' + v);
});

document.getElementById('btn-scroll').addEventListener('click', () => {
  const v = document.getElementById('custom-text').value.trim();
  if (v) send('SCROLL=' + v);
});

document.getElementById('btn-color').addEventListener('click', () => {
  const hex = document.getElementById('color-picker').value;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  send('COLOR=' + r + ',' + g + ',' + b);
});

document.getElementById('btn-color-reset').addEventListener('click', () => {
  send('PALETTE=' + document.getElementById('palette').value);
});

document.getElementById('btn-mqtt').addEventListener('click', () => {
  const host = document.getElementById('mqtt-host').value.trim();
  const port = document.getElementById('mqtt-port').value.trim() || '1883';
  if (host) send('MQTT=' + host + ':' + port);
});

document.getElementById('btn-status').addEventListener('click', () => {
  send('STATUS');
});

// Disable all action buttons on load until connected
setConnected(false);
