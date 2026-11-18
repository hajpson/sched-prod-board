import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4173/';
const origin = new URL(url).origin;
const browser = await chromium.launch();

async function run(page) {
  const out = {};
  await page.goto(url);
  out.loaderAtStart = await page.locator('[data-testid="loader"]').isVisible().catch(() => false);
  await page.waitForSelector('[data-testid="incident-row"]', { timeout: 30000 });
  out.loaderGone = (await page.locator('[data-testid="loader"]').count()) === 0;
  out.rows = await page.locator('[data-testid="incident-row"]').count();
  out.first = await page.locator('[data-testid="incident-row"]').first().getAttribute('data-id');
  out.buildMeta = await page.locator('meta[name="build"]').getAttribute('content');
  out.buildFooter = (await page.locator('[data-testid="build-sha"]').textContent()).trim();
  out.hooks = await page.evaluate(() => ['board','incident-list','incident-row','ack','build-sha'].map((h) => [h, document.querySelectorAll(`[data-testid="${h}"]`).length]));
  out.times = (await page.locator('[data-testid="incident-row"] time').allTextContents()).slice(0, 3);
  out.ackLabels = await page.locator('[data-testid="ack"]').first().textContent();
  await page.waitForTimeout(4500);
  out.rowsAfterWatch = await page.locator('[data-testid="incident-row"]').count();
  return out;
}

const ctx = await browser.newContext({ locale: 'en-GB', timezoneId: 'Europe/Berlin' });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const a = await run(page);
console.log('deployed:', JSON.stringify(a));
console.log('console errors:', errors);

const ackBtn = page.locator('[data-testid="ack"]').first();
console.log('ack buttons:', await page.locator('[data-testid="ack"]').count());
await browser.close();
