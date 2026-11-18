import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const board = document.querySelector('[data-testid="board"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');

const state = new Map();
const acks = new Map();
const seen = new Set();

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

function render() {
  const rows = ordered();
  list.innerHTML = rows
    .map(
      (i) => `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}">
        <span class="id">${esc(i.id)}</span>
        <span class="sev">${esc(i.severity)}</span>
        <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
        <time datetime="${esc(i.openedAt)}">${esc(localTime(i.openedAt))}</time>
        ${
          i.ackedAt
            ? `<span data-testid="acked" title="acked ${esc(i.ackedAt)}">acked</span>`
            : `<button type="button" data-testid="ack" data-id="${esc(i.id)}">Ack</button>`
        }
      </li>`,
    )
    .join('');
  empty.hidden = rows.length > 0;
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-testid="ack"]');
  if (!btn) return;
  const id = btn.dataset.id;
  btn.disabled = true;
  try {
    let reply = acks.get(id);
    if (!reply) {
      reply = await ack(id);
      acks.set(id, reply);
    }
    const row = state.get(id);
    if (row) state.set(id, { ...row, ackedAt: reply.ackedAt });
    render();
  } catch (err) {
    btn.disabled = false;
    console.error('ack failed', err);
  }
});

async function tick() {
  try {
    const page = await fetchIncidents();
    merge(page.incidents);
    if (loader) loader.hidden = true;
    render();
  } catch (err) {
    console.error('refresh failed', err);
  }
}

if (loader) loader.hidden = false;
await tick();
if (loader) loader.remove();
setInterval(tick, 2000);
