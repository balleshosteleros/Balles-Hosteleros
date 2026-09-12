import { chromium } from 'playwright';
const dir = '/private/tmp/claude-501/-Users-ivanballesteros-Balles-Hosteleros/31dd154f-6f00-433f-8baa-5f75a65af974/scratchpad';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto('http://localhost:4321/experiencia', { waitUntil: 'networkidle', timeout: 90000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${dir}/01-arriba.png` });
for (const [nombre, sel] of [['02-historia','#historia'],['03-espectaculo','section:has-text("Donde la gastronomía")'],['04-treinta','section:has-text("Tienes 30 días")'],['05-contacto','#contacto']]) {
  const el = p.locator(sel).first();
  if (await el.count()) { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200); await p.screenshot({ path: `${dir}/${nombre}.png` }); }
}
await b.close();
console.log('ok');
