// DRY-RUN del espejo de stock (SOLO LECTURA): lee el stock de un almacén de Ágora
// y mide cuánto se puede reflejar en los productos de una empresa de Balles.
// Uso: node scripts/agora/stock-mirror-dryrun.mjs <token> [warehouseId=4] [empresaId=BACANAL]
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('uso: node scripts/agora/stock-mirror-dryrun.mjs <token> [warehouseId] [empresaId]'); process.exit(2); }
const WH = Number(process.argv[3] || 4); // 4 = BACANAL FUENLABRADA
const EMP = process.argv[4] || 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'; // BACANAL

function loadEnv() {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) throw new Error('.env.local no encontrado');
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();
const BASE = process.env.AGORA_POS_URL || 'http://habanabacanaliictpv.ddns.me:8984';
const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '');
async function get(p) { const r = await fetch(BASE + p, { headers: { 'Api-Token': TOKEN, Accept: 'application/json' } }); if (!r.ok) throw new Error(`${p} -> HTTP ${r.status}`); return r.json(); }

const stocksAll = (await get('/api/export-master/?filter=Stocks')).Stocks || [];
const stocks = stocksAll.filter((s) => s.WarehouseId === WH);
const prods = (await get('/api/export-master/?filter=Products')).Products || [];
const nameById = new Map(prods.map((p) => [p.Id, p.Name]));

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: bprods, error } = await sb.from('productos').select('id, nombre, tipo, agora_id').eq('empresa_id', EMP);
if (error) throw error;
const byAgora = new Map(), byName = new Map();
for (const p of bprods || []) { if (p.agora_id) byAgora.set(String(p.agora_id), p); if (!byName.has(norm(p.nombre))) byName.set(norm(p.nombre), p); }

console.log(`Espejo de stock — Almacén Ágora ${WH} -> empresa Balles ${EMP}`);
console.log(`Filas de stock en almacén ${WH}: ${stocks.length} (de ${stocksAll.length} en todos los almacenes)`);
console.log(`Productos de esa empresa en Balles: ${(bprods || []).length}\n`);

let linked = 0, named = 0, none = 0;
const namedSample = [], noneTop = [];
const sorted = stocks.slice().sort((a, b) => Math.abs(b.Quantity) - Math.abs(a.Quantity));
for (const s of sorted) {
  const nm = nameById.get(s.ProductId) || '(no en catálogo)';
  let p = byAgora.get(String(s.ProductId)); let how = p ? 'agora' : null;
  if (!p) { p = byName.get(norm(nm)); how = p ? 'name' : 'none'; }
  if (how === 'agora') linked++;
  else if (how === 'name') { named++; if (namedSample.length < 12) namedSample.push(`${s.ProductId} "${nm}" (${s.Quantity}) ≈ "${p.nombre}"`); }
  else { none++; if (noneTop.length < 20) noneTop.push(`${s.ProductId} "${nm}" (${s.Quantity})`); }
}
console.log('Cobertura del espejo HOY:');
console.log(`  ✓ ya enlazados por agora_id: ${linked}`);
console.log(`  ~ emparejables por nombre (auto-enlazables): ${named}`);
console.log(`  ✗ sin equivalente en Balles: ${none}`);
console.log(`  → reflejaríamos ${linked + named} de ${stocks.length} líneas de stock`);
if (namedSample.length) { console.log('  · ejemplos auto-enlazables:'); namedSample.forEach((x) => console.log('      ' + x)); }
if (noneTop.length) { console.log('  · top SIN equivalente en Balles (existen en Ágora, no en Balles):'); noneTop.forEach((x) => console.log('      ' + x)); }
console.log('\nOK dry-run (no se ha escrito nada).');
