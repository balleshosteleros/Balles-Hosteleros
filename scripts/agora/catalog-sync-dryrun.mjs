// DRY-RUN de la sincronización de catálogo (SOLO LECTURA) con emparejado difuso.
// Sobre los productos que tienen stock en un almacén de Ágora, decide para cada uno:
//   ENLAZAR (match exacto) | CREAR (sin match) | REVISAR (posible duplicado, match difuso).
// Uso: node scripts/agora/catalog-sync-dryrun.mjs <token> [warehouseId=4] [empresaId=BACANAL]
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('uso: node scripts/agora/catalog-sync-dryrun.mjs <token> [warehouseId] [empresaId]'); process.exit(2); }
const WH = Number(process.argv[3] || 4);
const EMP = process.argv[4] || 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'; // BACANAL
const REVIEW_THRESHOLD = 0.80;

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
const norm = (s) => (s || '').toLowerCase().trim().replace(/[._/]/g, ' ').replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '');
async function get(p) { const r = await fetch(BASE + p, { headers: { 'Api-Token': TOKEN, Accept: 'application/json' } }); if (!r.ok) throw new Error(`${p} -> HTTP ${r.status}`); return r.json(); }

// similitud
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i), cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1; cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c); }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}
const ratio = (a, b) => 1 - lev(a, b) / (Math.max(a.length, b.length) || 1);
function jaccard(a, b) { const A = new Set(a.split(' ')), B = new Set(b.split(' ')); const inter = [...A].filter((x) => B.has(x)).length; const uni = new Set([...A, ...B]).size || 1; return inter / uni; }
const sim = (a, b) => Math.max(ratio(a, b), jaccard(a, b));

// Datos Ágora
const stocks = ((await get('/api/export-master/?filter=Stocks')).Stocks || []).filter((s) => s.WarehouseId === WH);
const prods = (await get('/api/export-master/?filter=Products')).Products || [];
const prodById = new Map(prods.map((p) => [p.Id, p]));
const fam = (await get('/api/export-master/?filter=Families')).Families || [];
const famById = new Map(fam.map((f) => [f.Id, f.Name]));

// Productos con stock en el almacén (lo que necesita el espejo)
const stockedIds = [...new Set(stocks.map((s) => s.ProductId))];
const qtyById = new Map(); for (const s of stocks) qtyById.set(s.ProductId, (qtyById.get(s.ProductId) || 0) + s.Quantity);

// Datos Balles
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: bprods, error } = await sb.from('productos').select('id, nombre, tipo, agora_id').eq('empresa_id', EMP);
if (error) throw error;
const byAgora = new Map(), byName = new Map();
const bList = (bprods || []).map((p) => ({ ...p, n: norm(p.nombre) }));
for (const p of bList) { if (p.agora_id) byAgora.set(String(p.agora_id), p); if (!byName.has(p.n)) byName.set(p.n, p); }

const linked = [], toCreate = [], review = [], already = [];
for (const id of stockedIds) {
  const ap = prodById.get(id);
  const aname = ap?.Name || `(id ${id})`;
  const an = norm(aname);
  const qty = qtyById.get(id) ?? 0;
  if (byAgora.has(String(id))) { already.push({ id, aname }); continue; }
  if (byName.has(an)) { linked.push({ id, aname, b: byName.get(an).nombre }); continue; }
  // difuso: mejor candidato
  let best = null, bestScore = 0;
  for (const p of bList) { const s = sim(an, p.n); if (s > bestScore) { bestScore = s; best = p; } }
  if (best && bestScore >= REVIEW_THRESHOLD) review.push({ id, aname, qty, b: best.nombre, score: bestScore.toFixed(2) });
  else toCreate.push({ id, aname, qty, cat: famById.get(ap?.FamilyId) || 'Ágora' });
}

console.log(`Almacén ${WH} -> empresa ${EMP}`);
console.log(`Productos con stock en almacén ${WH}: ${stockedIds.length}\n`);
console.log('RESUMEN del dry-run de catálogo:');
console.log(`  ya enlazados (agora_id): ${already.length}`);
console.log(`  ✓ ENLAZARÍA (match exacto de nombre): ${linked.length}`);
console.log(`  🔎 REVISAR (posible duplicado, parecido ≥${REVIEW_THRESHOLD}): ${review.length}`);
console.log(`  ➕ CREARÍA (sin equivalente): ${toCreate.length}`);
console.log(`  => cobertura tras sync: ${already.length + linked.length + review.length + toCreate.length}/${stockedIds.length}\n`);

console.log('— ENLAZARÍA (ejemplos) —');
linked.slice(0, 15).forEach((x) => console.log(`   ${x.id} "${x.aname}" -> "${x.b}"`));
console.log(`\n— 🔎 REVISAR posibles duplicados (TODOS, ${review.length}) —`);
review.sort((a, b) => b.score - a.score).forEach((x) => console.log(`   ${x.id} "${x.aname}" ≈ "${x.b}"  (parecido ${x.score}, stock ${x.qty})`));
console.log(`\n— ➕ CREARÍA (top 25 por stock, total ${toCreate.length}) —`);
toCreate.sort((a, b) => Math.abs(b.qty) - Math.abs(a.qty)).slice(0, 25).forEach((x) => console.log(`   ${x.id} "${x.aname}"  [${x.cat}]  stock ${x.qty}`));
console.log('\nOK dry-run (no se ha escrito nada).');
