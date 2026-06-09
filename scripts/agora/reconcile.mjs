// DRY-RUN / informe de reconciliación (SOLO LECTURA, no escribe nada).
// Cruza catálogo + ventas reales de Ágora contra los productos/recetas de Balles.
// Uso: node scripts/agora/reconcile.mjs <agora_token> [YYYY-MM-DD ...]
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const TOKEN = process.argv[2];
if (!TOKEN) { console.error('uso: node scripts/agora/reconcile.mjs <agora_token> [dias...]'); process.exit(2); }
const DAYS = process.argv.slice(3);
if (DAYS.length === 0) DAYS.push('2026-06-06', '2026-06-07', '2026-06-08');

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

const WP_TO_EMP = {
  1: { nombre: 'HABANA', empresaId: '00000000-0000-0000-0000-000000000001' },
  4: { nombre: 'BACANAL', empresaId: 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47' },
};

const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '');

async function agoraGet(path) {
  const r = await fetch(BASE + path, { headers: { 'Api-Token': TOKEN, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Ágora ${path} -> HTTP ${r.status} ${r.statusText}`);
  return r.json();
}

// 1) Catálogo Ágora
const catalog = (await agoraGet('/api/export-master/?filter=Products')).Products || [];
const agoraById = new Map(catalog.map((p) => [p.Id, p]));
console.log(`Días muestreados: ${DAYS.join(', ')}`);
console.log(`Catálogo Ágora: ${catalog.length} productos (${catalog.filter((p) => !p.DeletionDate).length} activos)\n`);

// 2) Ventas por workplace
const soldByWp = new Map();
for (const day of DAYS) {
  const inv = (await agoraGet(`/api/export/?business-day=${day}&filter=Invoices`)).Invoices || [];
  for (const f of inv) {
    const wp = f.Workplace?.Id;
    if (!soldByWp.has(wp)) soldByWp.set(wp, new Map());
    const m = soldByWp.get(wp);
    for (const it of f.InvoiceItems || []) {
      for (const ln of it.Lines || []) {
        const pid = ln.ProductId;
        if (pid == null) continue;
        const q = Number(ln.Quantity) || 0;
        if (q <= 0) continue;
        const prev = m.get(pid) || { name: ln.ProductName || '', qty: 0, type: ln.Type };
        prev.qty += q;
        m.set(pid, prev);
      }
    }
  }
}

// 3) Balles: productos + recetas
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: prods, error: pe } = await sb.from('productos').select('id, empresa_id, nombre, tipo, agora_id');
if (pe) throw pe;
const { data: comp } = await sb.from('producto_composicion').select('producto_venta_id');
const conReceta = new Set((comp || []).map((c) => c.producto_venta_id));

function idxEmpresa(empresaId) {
  const list = (prods || []).filter((p) => p.empresa_id === empresaId);
  const byAgora = new Map();
  const byName = new Map();
  for (const p of list) {
    if (p.agora_id) byAgora.set(String(p.agora_id), p);
    if (!byName.has(norm(p.nombre))) byName.set(norm(p.nombre), p);
  }
  return { list, byAgora, byName };
}

for (const [wp, m] of soldByWp) {
  const emp = WP_TO_EMP[wp];
  console.log(`\n===== Workplace ${wp} -> ${emp ? emp.nombre : '¿sin mapeo?'} =====`);
  console.log(`Productos distintos vendidos: ${m.size}`);
  if (!emp) { console.log('  (no hay empresa Balles mapeada a este workplace)'); continue; }
  const { list, byAgora, byName } = idxEmpresa(emp.empresaId);
  console.log(`Productos de ${emp.nombre} en Balles: ${list.length}`);

  let linked = 0, named = 0, missing = 0, wouldDiscount = 0, ventaSinReceta = 0;
  const namedSample = [], ventaSinRecetaSample = [], missingTop = [];
  const sold = [...m.entries()].sort((a, b) => b[1].qty - a[1].qty);

  for (const [pid, info] of sold) {
    let p = byAgora.get(String(pid));
    let how = p ? 'linked' : null;
    if (!p) {
      const an = norm(agoraById.get(pid)?.Name || info.name);
      p = byName.get(an);
      how = p ? 'name' : 'none';
    }
    if (how === 'linked') linked++;
    else if (how === 'name') { named++; if (namedSample.length < 12) namedSample.push(`${pid} "${info.name}" ≈ "${p.nombre}"`); }
    else { missing++; if (missingTop.length < 15) missingTop.push(`${pid} "${info.name}" (x${info.qty})`); continue; }

    if (p.tipo === 'compra') wouldDiscount++;
    else if (p.tipo === 'venta' && conReceta.has(p.id)) wouldDiscount++;
    else { ventaSinReceta++; if (ventaSinRecetaSample.length < 12) ventaSinRecetaSample.push(`"${info.name}" (${p.tipo}${conReceta.has(p.id) ? '' : ', sin receta'})`); }
  }

  console.log(`  ✓ ya enlazados por agora_id: ${linked}`);
  console.log(`  ~ emparejables por nombre (solo faltaría poner agora_id): ${named}`);
  console.log(`  ✗ sin equivalente en Balles (habría que crearlos): ${missing}`);
  console.log(`  → de los emparejados, DESCONTARÍAN stock (compra 1:1 o venta con receta): ${wouldDiscount}`);
  console.log(`  → emparejados pero venta SIN receta (se omitirían): ${ventaSinReceta}`);
  if (namedSample.length) { console.log('  · ejemplos emparejables por nombre:'); namedSample.forEach((s) => console.log('      ' + s)); }
  if (ventaSinRecetaSample.length) { console.log('  · ejemplos venta sin receta:'); ventaSinRecetaSample.forEach((s) => console.log('      ' + s)); }
  if (missingTop.length) { console.log('  · top vendidos SIN equivalente en Balles:'); missingTop.forEach((s) => console.log('      ' + s)); }
}

console.log('\nNOTA: stock está vacío → aunque "descontaría", hoy no hay existencias que mover (falta inventario inicial).');
console.log('OK reconcile (no se ha escrito nada).');
