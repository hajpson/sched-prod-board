import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));

await page.goto(url);

await page.waitForSelector('[data-testid="incident-row"]', { timeout: 20000 });
console.log('loader gone after first load:', (await page.locator('[data-testid="loader"]').count()) === 0);
const rows = await page.locator('[data-testid="incident-row"]').count();
console.log('rows:', rows);
console.log('first row:', await page.locator('[data-testid="incident-row"]').first().getAttribute('data-id'));
console.log('times:', await page.locator('[data-testid="incident-row"] time').allTextContents());
console.log('build meta:', await page.locator('meta[name="build"]').getAttribute('content'));
console.log('build footer:', await page.locator('[data-testid="build-sha"]').textContent());
console.log('ack buttons:', await page.locator('[data-testid="ack"]').count());

const firstId = await page.locator('[data-testid="incident-row"]').first().getAttribute('data-id');
const before = await page.locator('[data-testid="incident-row"]').count();
await page.waitForTimeout(6000);
const after = await page.locator('[data-testid="incident-row"]').count();
console.log('rows before/after 6s wait:', before, after);
console.log('logs:', logs.join(' | '));
await page.screenshot({ path: '/tmp/board-first.png', fullPage: true });
await browser.close();
