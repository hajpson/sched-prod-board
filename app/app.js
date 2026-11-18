import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const board = document.querySelector('[data-testid="board"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const panel = document.querySelector('[data-testid="incident-panel"]');

const state = new Map();
const acks = new Map();
const seen = new Set();
const nodes = new Map();
let openId = null;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fmt = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function localTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : fmt.format(d);
}

function merge(incidents) {
  for (const i of incidents) {
    const prev = state.get(i.id) || {};
    state.set(i.id, { ...i, ackedAt: prev.ackedAt });
    seen.add(i.id);
  }
}

function ordered() {
  return [...state.values()]
    .filter((i) => seen.has(i.id))
    .sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));
}

// One row element per incident, kept across refreshes: a refresh must never take a row out of the page.
function rowFor(i) {
  let row = nodes.get(i.id);
  if (row) return row;
  row = document.createElement('li');
  row.dataset.testid = 'incident-row';
  row.dataset.id = i.id;
  row.innerHTML = `
    <span class="id"></span>
    <span class="sev"></span>
    <span class="what"></span>
    <time></time>
    <span class="mark"></span>`;
  nodes.set(i.id, row);
  return row;
}

function fill(row, i) {
  row.className = `row ${i.severity}${i.ackedAt ? ' acked' : ''}`;
  row.querySelector('.id').textContent = i.id;
  row.querySelector('.sev').textContent = i.severity;
  row.querySelector('.what').textContent = `${i.service} · ${i.region} · ${i.summary}`;
  const t = row.querySelector('time');
  t.setAttribute('datetime', i.openedAt);
  t.textContent = localTime(i.openedAt);
  const mark = row.querySelector('.mark');
  const want = i.ackedAt ? 'acked' : '';
  if (mark.dataset.testid !== want) {
    mark.dataset.testid = want;
    mark.removeAttribute('title');
  }
  if (i.ackedAt) mark.title = `acked ${i.ackedAt}`;
}

// Rows move only by being re-ordered in place; the same nodes stay in the list.
function renderList() {
  const rows = ordered();
  for (const i of rows) fill(rowFor(i), i);
  rows.forEach((i, at) => {
    const row = nodes.get(i.id);
    const here = list.children[at] || null;
    if (here !== row) list.insertBefore(row, here);
  });
  empty.hidden = rows.length > 0;
  if (openId && !state.has(openId)) closePanel();
}

function renderPanel() {
  const i = openId ? state.get(openId) : null;
  if (!i) {
    panel.hidden = true;
    panel.removeAttribute('data-id');
    panel.textContent = '';
    return;
  }
  panel.hidden = false;
  panel.dataset.id = i.id;
  panel.innerHTML = `
    <h2><span class="pid"></span> <span class="psev"></span></h2>
    <p class="pwhat"></p>
    <p class="ptime"></p>
    <div class="pact"></div>`;
  panel.querySelector('.pid').textContent = i.id;
  panel.querySelector('.psev').textContent = i.severity;
  panel.querySelector('.pwhat').textContent = `${i.service} · ${i.region} · ${i.summary}`;
  panel.querySelector('.ptime').textContent = `opened ${localTime(i.openedAt)}`;
  const act = panel.querySelector('.pact');
  if (i.ackedAt) {
    const mark = document.createElement('span');
    mark.dataset.testid = 'acked';
    mark.title = `acked ${i.ackedAt}`;
    mark.textContent = 'acked';
    act.append(mark);
  } else {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.testid = 'panel-ack';
    btn.dataset.id = i.id;
    btn.textContent = `Ack ${i.id}`;
    act.append(btn);
  }
}

function open(id) {
  openId = id;
  renderPanel();
}

function closePanel() {
  openId = null;
  renderPanel();
}

list.addEventListener('click', async (e) => {
  const row = e.target.closest('[data-testid="incident-row"]');
  if (!row) return;
  open(row.dataset.id);
});

panel.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="panel-ack"]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.busy === id) return;
  btn.dataset.busy = id;
  btn.disabled = true;
  try {
    let reply = acks.get(id);
    if (!reply) {
      reply = await ack(id);
      acks.set(id, reply);
    }
    const row = state.get(id);
    if (row) state.set(id, { ...row, ackedAt: reply.ackedAt });
    renderList();
    renderPanel();
  } catch (err) {
    btn.disabled = false;
    delete btn.dataset.busy;
    console.error('ack failed', err);
  }
});

async function tick() {
  try {
    const page = await fetchIncidents();
    merge(page.incidents);
    if (loader && !loader.hidden) loader.remove();
    renderList();
    renderPanel();
  } catch (err) {
    console.error('refresh failed', err);
  }
}

if (loader) loader.hidden = false;
await tick();
if (loader && loader.isConnected) loader.remove();
setInterval(tick, 2000);
