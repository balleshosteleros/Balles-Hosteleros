// Migración catálogo Ágora -> Balles (Bacanal + Habana).
// Lee /tmp/migracion.json (generado desde el Excel con todas las reglas) y enriquece
// coste/unidad/stock desde la API de Ágora. DRY-RUN por defecto; --write ejecuta.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const WRITE = process.argv.includes('--write');
function loadEnv() {
  const p = resolve(process.cwd(), '.env.local');
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const BASE = (process.env.AGORA_API_URL || 'http://habanabacanaliictpv.ddns.me:8984').replace(/\/$/, '');
const TOKEN = process.env.AGORA_API_TOKEN;
const agoraGet = async (p) => { const r = await fetch(BASE + p, { headers: { 'Api-Token': TOKEN, Accept: 'application/json' } }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); };
const EMP = { BACANAL: 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47', HABANA: '00000000-0000-0000-0000-000000000001' };
const WH = { BACANAL: 4, HABANA: 1 };
const TAG = 'Importado de Agora 2026-06-10';

const recs = JSON.parse(readFileSync('/tmp/migracion.json', 'utf-8'));

// Enriquecer desde Ágora: coste (CostPrices por almacén), unidad (IsSoldByWeight), stock (Stocks)
const prods = (await agoraGet('/api/export-master/?filter=Products')).Products.filter(p => !p.DeletionDate);
const byId = new Map(prods.map(p => [String(p.Id), p]));
const stocks = (await agoraGet('/api/export-master/?filter=Stocks')).Stocks || [];
const stockBy = {}; // `${wh}:${id}` -> qty
for (const s of stocks) stockBy[`${s.WarehouseId}:${s.ProductId}`] = s.Quantity;
const coste = (id, emp) => { const p = byId.get(id); if (!p) return null; const c = (p.CostPrices || []).find(x => x.WarehouseId === WH[emp]); return c ? String(c.CostPrice) : (p.CostPrice != null ? String(p.CostPrice) : null); };
const unidad = (id) => { const p = byId.get(id); return p && p.IsSoldByWeight ? 'kg' : 'ud'; };

// Estado actual
const { count: bacCount } = await sb.from('productos').select('*', { count: 'exact', head: true }).eq('empresa_id', EMP.BACANAL);
const { count: habCount } = await sb.from('productos').select('*', { count: 'exact', head: true }).eq('empresa_id', EMP.HABANA);
console.log(`\n=== ESTADO ACTUAL ===\n  Bacanal: ${bacCount} productos · Habana: ${habCount} productos`);
console.log(`=== A MIGRAR (de /tmp/migracion.json) ===\n  ${recs.length} registros`);

const filasProducto = recs.map(r => ({
  empresa_id: r.empresa_id, tipo: r.tipo, nombre: r.nombre, categoria: r.categoria, estado: 'Activo',
  precio_venta: r.precio_venta, coste: coste(r.agora_id, r.empresa), unidad: unidad(r.agora_id),
  agora_id: r.agora_id, observaciones: TAG,
}));

if (!WRITE) {
  console.log('\n*** DRY-RUN (no se escribe nada). Usa --write para ejecutar. ***');
  console.log('Ejemplos de filas a insertar:');
  for (const f of filasProducto.slice(0, 4)) console.log('  ', JSON.stringify(f));
  const ambos = recs.filter(r => r.ambos);
  console.log(`Recetas 1:1 (ambos): ${new Set(ambos.map(r => r.empresa + ':' + r.agora_id)).size} pares`);
  const conStock = recs.filter(r => r.tipo === 'compra' && stockBy[`${WH[r.empresa]}:${r.agora_id}`] != null).length;
  console.log(`Filas de stock a crear (compra con existencias en Ágora): ${conStock}`);
  process.exit(0);
}

// ---- ESCRITURA ----
console.log('\n=== BORRANDO catálogo de BACANAL y HABANA (backup Bacanal en backup_agora) ===');
for (const e of [EMP.BACANAL, EMP.HABANA]) {
  const del = await sb.from('productos').delete().eq('empresa_id', e);
  if (del.error) throw del.error;
}
console.log('  Borrado OK (CASCADE limpió recetas/stock/precios).');

console.log('=== INSERTANDO productos ===');
const inserted = [];
for (let i = 0; i < filasProducto.length; i += 100) {
  const batch = filasProducto.slice(i, i + 100);
  const { data, error } = await sb.from('productos').insert(batch).select('id,empresa_id,agora_id,tipo,nombre');
  if (error) throw error;
  inserted.push(...data);
  console.log(`  insertados ${inserted.length}/${filasProducto.length}`);
}

// Mapa para recetas y stock
const key = (emp, agora, tipo) => `${emp}|${agora}|${tipo}`;
const idMap = new Map();
for (const p of inserted) {
  const emp = p.empresa_id === EMP.BACANAL ? 'BACANAL' : 'HABANA';
  idMap.set(key(emp, p.agora_id, p.tipo), p);
}

console.log('=== CREANDO recetas 1:1 de los "ambos" ===');
const recetas = [];
for (const r of recs.filter(x => x.ambos && x.tipo === 'venta')) {
  const v = idMap.get(key(r.empresa, r.agora_id, 'venta'));
  const c = idMap.get(key(r.empresa, r.agora_id, 'compra'));
  if (v && c) recetas.push({ producto_venta_id: v.id, ingrediente_id: c.id, cantidad: 1, merma_pct: 0 });
}
for (let i = 0; i < recetas.length; i += 100) {
  const { error } = await sb.from('producto_composicion').insert(recetas.slice(i, i + 100));
  if (error) throw error;
}
console.log(`  ${recetas.length} recetas creadas.`);

console.log('=== CREANDO stock (compra con existencias en Ágora) ===');
const filasStock = [];
for (const r of recs.filter(x => x.tipo === 'compra')) {
  const qty = stockBy[`${WH[r.empresa]}:${r.agora_id}`];
  if (qty == null) continue;
  const p = idMap.get(key(r.empresa, r.agora_id, 'compra'));
  if (!p) continue;
  filasStock.push({ empresa_id: r.empresa_id, producto_id: p.id, producto_nombre: r.nombre, cantidad_actual: qty, cantidad_minima: 0, cantidad_maxima: 0, unidad: unidad(r.agora_id) });
}
for (let i = 0; i < filasStock.length; i += 100) {
  const { error } = await sb.from('stock').insert(filasStock.slice(i, i + 100));
  if (error) throw error;
}
console.log(`  ${filasStock.length} filas de stock creadas.`);
console.log('\n✅ MIGRACIÓN COMPLETADA.');
