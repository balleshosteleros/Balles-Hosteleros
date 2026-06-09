// Sincronización Bacanal: catálogo (enlazar/crear) + espejo de stock desde Ágora.
// Por defecto DRY-RUN. Escribe SOLO si se pasa --write. Idempotente (re-ejecutable).
// Uso: node scripts/agora/sync-bacanal.mjs <token> [--write]
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('uso: node scripts/agora/sync-bacanal.mjs <token> [--write]'); process.exit(2); }
const WRITE = process.argv.includes('--write');
const WH = 4;
const EMP = 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'; // BACANAL
const STAMP = 'Importado de Agora (espejo stock) 2026-06-09';
const LINK_THRESHOLD = 0.80;

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
const nowISO = new Date().toISOString();
const norm = (s) => (s || '').toLowerCase().trim().replace(/[._/]/g, ' ').replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '');
async function get(p) { const r = await fetch(BASE + p, { headers: { 'Api-Token': TOKEN, Accept: 'application/json' } }); if (!r.ok) throw new Error(`${p} -> HTTP ${r.status}`); return r.json(); }
function lev(a, b) { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, i) => i), cur = new Array(n + 1); for (let i = 1; i <= m; i++) { cur[0] = i; for (let j = 1; j <= n; j++) { const c = a[i - 1] === b[j - 1] ? 0 : 1; cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c); } [prev, cur] = [cur, prev]; } return prev[n]; }
const ratio = (a, b) => 1 - lev(a, b) / (Math.max(a.length, b.length) || 1);
function jaccard(a, b) { const A = new Set(a.split(' ')), B = new Set(b.split(' ')); const inter = [...A].filter((x) => B.has(x)).length; return inter / (new Set([...A, ...B]).size || 1); }
const sim = (a, b) => Math.max(ratio(a, b), jaccard(a, b));

// ── Ágora ──
const stocks = ((await get('/api/export-master/?filter=Stocks')).Stocks || []).filter((s) => s.WarehouseId === WH);
const prods = (await get('/api/export-master/?filter=Products')).Products || [];
const prodById = new Map(prods.map((p) => [p.Id, p]));
const famById = new Map(((await get('/api/export-master/?filter=Families')).Families || []).map((f) => [f.Id, f.Name]));
const stockedIds = [...new Set(stocks.map((s) => s.ProductId))];
const qtyById = new Map(); for (const s of stocks) qtyById.set(s.ProductId, (qtyById.get(s.ProductId) || 0) + s.Quantity);

// ── Balles ──
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: bprods, error } = await sb.from('productos').select('id, nombre, tipo, agora_id').eq('empresa_id', EMP);
if (error) throw error;
const bList = (bprods || []).map((p) => ({ ...p, n: norm(p.nombre) }));
const byAgora = new Map(), byName = new Map();
for (const p of bList) { if (p.agora_id) byAgora.set(String(p.agora_id), p); if (!byName.has(p.n)) byName.set(p.n, p); }

// ── Clasificar (agoraToBalles cubre TODOS los stocked) ──
const linkOps = [], createRows = [], used = new Set();
const agoraToBalles = new Map();
for (const id of stockedIds) {
  const ap = prodById.get(id);
  const aname = ap?.Name || `(id ${id})`;
  const an = norm(aname);
  const existing = byAgora.get(String(id));
  if (existing) { agoraToBalles.set(String(id), existing.id); continue; }
  let cand = byName.get(an);
  if (!cand) { let best = null, bs = 0; for (const p of bList) { const s = sim(an, p.n); if (s > bs) { bs = s; best = p; } } if (best && bs >= LINK_THRESHOLD) cand = best; }
  if (cand && !used.has(cand.id)) { used.add(cand.id); linkOps.push({ agoraId: id, ballesId: cand.id, aname }); agoraToBalles.set(String(id), cand.id); }
  else createRows.push({ empresa_id: EMP, tipo: 'compra', nombre: aname, categoria: famById.get(ap?.FamilyId) || 'Agora', estado: 'Activo', unidad: 'ud', agora_id: String(id), observaciones: STAMP });
}

console.log(`=== SYNC BACANAL (almacén ${WH} -> empresa ${EMP}) ===`);
console.log(`Modo: ${WRITE ? 'WRITE (escribe en producción)' : 'DRY-RUN (no escribe)'}`);
console.log(`Productos con stock: ${stockedIds.length}`);
console.log(`Plan: ENLAZAR ${linkOps.length} (ya enlazados ${stockedIds.length - linkOps.length - createRows.length}) · CREAR ${createRows.length} · ESPEJO STOCK ${stockedIds.length}`);
if (!WRITE) { console.log('\n(dry-run: pasa --write para ejecutar)'); process.exit(0); }

// ── 1. Enlazar (idempotente) ──
let linked = 0;
for (const op of linkOps) {
  const { error: e } = await sb.from('productos').update({ agora_id: String(op.agoraId) }).eq('id', op.ballesId);
  if (e) console.error(`  link error ${op.aname}: ${e.message}`); else linked++;
}
console.log(`enlazados: ${linked}/${linkOps.length}`);

// ── 2. Crear (sin ON CONFLICT: filtrar existentes + insert) ──
const { data: cur } = await sb.from('productos').select('id, agora_id').eq('empresa_id', EMP).not('agora_id', 'is', null);
const idByAgoraDB = new Map((cur || []).map((r) => [String(r.agora_id), r.id]));
const toInsert = createRows.filter((r) => !idByAgoraDB.has(String(r.agora_id)));
// los que ya existían (re-run): mapearlos para el stock
for (const r of createRows) { const ex = idByAgoraDB.get(String(r.agora_id)); if (ex) agoraToBalles.set(String(r.agora_id), ex); }
let created = 0;
for (let i = 0; i < toInsert.length; i += 200) {
  const { data, error: e } = await sb.from('productos').insert(toInsert.slice(i, i + 200)).select('id, agora_id');
  if (e) { console.error('  create batch error:', e.message); throw e; }
  for (const r of data || []) agoraToBalles.set(String(r.agora_id), r.id);
  created += (data || []).length;
}
console.log(`creados: ${created} (ya existían ${createRows.length - toInsert.length})`);

// ── 3. Espejo de stock (idempotente: limpiar + insertar) ──
const prodIds = [...new Set([...agoraToBalles.values()])];
for (let i = 0; i < prodIds.length; i += 200) await sb.from('stock').delete().eq('empresa_id', EMP).in('producto_id', prodIds.slice(i, i + 200));
const stockRows = [];
for (const id of stockedIds) {
  const pid = agoraToBalles.get(String(id));
  if (!pid) continue;
  stockRows.push({ empresa_id: EMP, producto_id: pid, producto_nombre: prodById.get(id)?.Name || `(id ${id})`, cantidad_actual: qtyById.get(id) ?? 0, unidad: 'ud', ultimo_movimiento: nowISO });
}
let stockIns = 0;
for (let i = 0; i < stockRows.length; i += 200) {
  const { data, error: e } = await sb.from('stock').insert(stockRows.slice(i, i + 200)).select('id');
  if (e) { console.error('  stock batch error:', e.message); throw e; }
  stockIns += (data || []).length;
}
console.log(`stock reflejado: ${stockIns}/${stockRows.length}`);

// ── Verificación ──
const { count: cAgora } = await sb.from('productos').select('*', { count: 'exact', head: true }).eq('empresa_id', EMP).not('agora_id', 'is', null);
const { count: cStock } = await sb.from('stock').select('*', { count: 'exact', head: true }).eq('empresa_id', EMP);
console.log(`\nVERIFICACIÓN: productos Bacanal con agora_id = ${cAgora} · filas de stock Bacanal = ${cStock}`);
console.log('OK sync.');
