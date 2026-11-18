import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'https://hajpson.github.io/sched-prod-board/';
const outDir = process.argv[3] || '.work/watch';
const maxSecs = Number(process.argv[4] || 300);
const extraAfter = Number(process.argv[5] || 4);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
  locale: 'en-GB',
  timezoneId: 'Europe/Berlin',
});
const page = await ctx.newPage();
const t0 = Date.now();
const at = () => {
  const s = (Date.now() - t0) / 1000;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const trace = [];
const note = (kind, data = {}) => {
  const e = { at: at(), t: Number(((Date.now() - t0) / 1000).toFixed(2)), ...data, event: kind };
  console.log(JSON.stringify(e));
  return e;
};

const samples = [];
page.on('response', async (res) => {
  if (!res.url().includes('/incidents') || !res.ok()) return;
  let j;
  try { j = await res.json(); } catch { return; }
  samples.push({ at: at(), n: j.incidents.length, top: j.incidents[0]?.id ?? null });
});

await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 30000 });
await page.waitForTimeout(1500);

const rows = () => page.locator('[data-testid="incident-row"]').evaluateAll((els) => els.map((e) => e.dataset.id));
const before = await rows();
trace.push(note('open-board', { rows: before.length, top: before[0], build: await page.locator('[data-testid="build-sha"]').textContent(), meta: await page.locator('meta[name="build"]').getAttribute('content') }));

let appeared = null;
while (!appeared && (Date.now() - t0) / 1000 < maxSecs) {
  await page.waitForTimeout(250);
  const now = await rows();
  const fresh = now.filter((id) => !before.includes(id));
  if (fresh.length) {
    appeared = note('new-incident-appeared', { newIds: fresh, rowsNow: now.length, top: now[0] });
    trace.push(appeared);
  }
}

if (appeared) {
  const s = samples[samples.length - 1];
  await page.waitForTimeout(extraAfter * 1000);
  const after = await rows();
  trace.push(note('after', { rows: after.length, top: after[0], stillTop: after[0] === appeared.newIds[0] }));
  await page.screenshot({ path: `${outDir}/after.png`, fullPage: true });
}

const video = await page.video().path();
await ctx.close();
await browser.close();
writeFileSync(`${outDir}/trace.json`, JSON.stringify({ base, trace, samples }, null, 2));
console.log('video:', video);
