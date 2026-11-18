import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:4173/';
const outDir = process.argv[3] || '.work/recording';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 720 } },
  locale: 'en-GB',
  timezoneId: 'Europe/Berlin',
});
const page = await context.newPage();

const events = [];
const t0 = Date.now();
const at = () => {
  const s = (Date.now() - t0) / 1000;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const say = (what, extra = {}) => {
  const e = { flow: what, at: at(), ...extra };
  events.push(e);
  console.log(JSON.stringify(e));
};

const receipts = [];
page.on('console', (m) => {
  if (m.type() === 'info' && m.text().startsWith('ack ')) {
    const parts = m.text().split(' ');
    receipts.push({ id: parts[1], ackedAt: parts[2], receipt: parts[3] });
  }
});

await page.goto(url + (url.includes('?') ? '&' : '?') + 'record=1');

const loaderShown = await page.locator('[data-testid="loader"]').isVisible().catch(() => false);
await page.waitForSelector('[data-testid="incident-row"]', { timeout: 30000 });
await page.waitForTimeout(1200);
const rowsOpen = await page.locator('[data-testid="incident-row"]').count();
say('open-board', {
  url,
  rows: rowsOpen,
  first: await page.locator('[data-testid="incident-row"]').first().getAttribute('data-id'),
  loaderGone: (await page.locator('[data-testid="loader"]').count()) === 0,
  build: await page.locator('[data-testid="build-sha"]').textContent(),
  meta: await page.locator('meta[name="build"]').getAttribute('content'),
  times: await page.locator('[data-testid="incident-row"] time').allTextContents(),
  loaderShownAtStart: loaderShown,
});

await page.waitForTimeout(5000);
const rowsWatched = await page.locator('[data-testid="incident-row"]').count();
say('watch-board', { waitedSeconds: 5, rowsBefore: rowsOpen, rowsAfter: rowsWatched });
await page.screenshot({ path: `${outDir}/board.png`, fullPage: true });

const ackBtn = page.locator('[data-testid="ack"]').first();
const ackId = await ackBtn.getAttribute('data-id');
await ackBtn.hover();
await page.waitForTimeout(400);
await ackBtn.click();
await page.waitForSelector(`[data-testid="incident-row"][data-id="${ackId}"] [data-testid="acked"]`, { timeout: 15000 });
await page.waitForTimeout(600);
const acked = receipts[receipts.length - 1];
say('ack-incident', { id: ackId, ackedAt: acked?.ackedAt, receipt: acked?.receipt });

await page.waitForTimeout(4000);
const stillAcked = await page.locator(`[data-testid="incident-row"][data-id="${ackId}"] [data-testid="acked"]`).count();
say('ack-after-refresh', { id: ackId, stillAcked: stillAcked === 1 });
await page.screenshot({ path: `${outDir}/board-acked.png`, fullPage: true });

await page.waitForTimeout(1500);
const video = await page.video().path();
await context.close();
await browser.close();

writeFileSync(`${outDir}/events.json`, JSON.stringify({ url, events, receipts }, null, 2));
console.log('video:', video);
console.log('last receipt:', JSON.stringify(acked));
