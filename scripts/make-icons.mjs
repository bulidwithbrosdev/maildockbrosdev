// Renders the app icon (src/web/public/favicon.svg) to the PNG sizes the web app manifest needs.
import { readFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../src/web/public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
});
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;display:grid;place-items:center;height:100vh;overflow:hidden">
    <div style="width:${size}px;height:${size}px">${svg.replace(/width="[^"]*"\s+height="[^"]*"/, 'width="100%" height="100%"')}</div></body></html>`);
  const outPath = fileURLToPath(new URL(`../src/web/public/icon-${size}.png`, import.meta.url));
  await page.screenshot({ path: outPath, omitBackground: true });
  await page.close();
  console.log(`Generated icon-${size}.png`);
}
await browser.close();

const appleTouchPath = fileURLToPath(new URL('../src/web/public/apple-touch-icon.png', import.meta.url));
const icon192Path = fileURLToPath(new URL('../src/web/public/icon-192.png', import.meta.url));
copyFileSync(icon192Path, appleTouchPath);
console.log('Updated apple-touch-icon.png');
