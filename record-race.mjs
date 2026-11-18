import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.argv[2] || 'https://sched-prod-board.kacpah.workers.dev/';
const outDir = process.argv[3] || '.work/race';
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
const note = (k, v = {}) => { const e = { at: at(), ...v, what: k }; trace.push(e); console.log(JSON.stringify(e)); };

const receipts = [];
page.on('console', (m) => {
  if (m.type() === 'info' && m.text().startsWith('ack ')) {
    const [, id, ackedAt, receipt] = m.text().split(' ');
    receipts.push({ id, ackedAt, receipt, at: at() });
    note('receipt', { id, ackedAt, receipt });
  }
});
page.on('pageerror', (e) => note('pageerror', { message: e.message }));

await page.goto(url);
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 30000 });
await page.waitForTimeout(1000);

const ackRows = () => page.locator('[data-testid="ack"]');
const buttons = ackRows();
const n = await buttons.count();
const target = buttons.nth(1);
const targetId = await target.getAttribute('data-id');
note('look', { rows: n, rowSizes: await page.locator('[data-testid="incident-row"]').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))) });

// Look at the row, move to it, then wait past a refresh and click without waiting for the page to settle.
await target.scrollIntoViewIfNeeded();
const box = await target.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
await page.waitForTimeout(2300);
const btnNow = page.locator(`[data-testid="ack"][data-id="${targetId}"]`);
const exists = await btnNow.count();
note('aim', { id: targetId, stillOnRow: exists });
await page.mouse.down();
await page.mouse.up();
note('clicked', { id: targetId });

await page.waitForTimeout(1500);
const acked = await page.locator('[data-testid="acked"]').count();
const gotId = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="incident-row"]')].find((r) => r.querySelector('[data-testid="acked"]'))?.dataset.id,
);
note('after', { ackedMarks: acked, ackedRow: gotId, meant: targetId, match: gotId === targetId });
await page.screenshot({ path: `${outDir}/after.png`, fullPage: true });
await page.waitForTimeout(1200);

const video = await page.video().path();
await ctx.close();
await browser.close();
writeFileSync(`${outDir}/trace.json`, JSON.stringify({ url, trace }, null, 2));
console.log('video:', video);
