import { chromium } from '@playwright/test';
const [url, out, w] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: Number(w), height: 900 }, reducedMotion: 'reduce' });
await p.goto(url); await p.waitForLoadState('networkidle');
await p.screenshot({ path: out, fullPage: true });
await b.close();
