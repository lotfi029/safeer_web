import { chromium } from '@playwright/test';
const [url, out, w] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: Number(w), height: 900 }, reducedMotion: 'reduce' });
const errors = []; p.on('console', m => m.type() === 'error' && errors.push(m.text()));
await p.goto(url); await p.waitForLoadState('networkidle');
for (let y = 0; y < 20000; y += 600) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(60); }
await p.waitForLoadState('networkidle');
await p.screenshot({ path: out, fullPage: true });
console.log('errors:', errors.slice(0, 5));
await b.close();
