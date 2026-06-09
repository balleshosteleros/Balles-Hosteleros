// Recon SOLO LECTURA del estado real de la BD para planificar el import de Ágora.
// Uso: node scripts/agora/db-recon.mjs   (desde la raíz del proyecto)
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) throw new Error('.env.local no encontrado en ' + p);
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

console.log('Conectado a', url, '\n');

const { data: empresas, error: eErr } = await sb.from('empresas').select('id, nombre').order('nombre');
if (eErr) throw eErr;
console.log('== EMPRESAS ==', empresas.length);
for (const e of empresas) console.log('  ', e.id, '—', e.nombre);
const nombreDe = (id) => empresas.find((e) => e.id === id)?.nombre ?? id ?? 'NULL';

const { data: prods, error: pErr } = await sb.from('productos').select('empresa_id, tipo, agora_id');
if (pErr) throw pErr;
console.log('\n== PRODUCTOS == total:', prods.length);
const byEmp = {};
for (const p of prods) {
  const k = p.empresa_id || 'NULL';
  byEmp[k] ??= { venta: 0, compra: 0, conAgora: 0 };
  byEmp[k][p.tipo] = (byEmp[k][p.tipo] || 0) + 1;
  if (p.agora_id) byEmp[k].conAgora++;
}
for (const [k, v] of Object.entries(byEmp)) {
  console.log(`  ${nombreDe(k)}: venta=${v.venta} compra=${v.compra} con_agora_id=${v.conAgora}`);
}

console.log('\n== TABLA DE ESCANDALLOS (cuál existe de verdad) ==');
for (const t of ['producto_composicion', 'escandallos']) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t}:`, error ? `NO/err -> ${error.message}` : `${count} filas`);
}

const { data: stock, error: sErr } = await sb.from('stock').select('empresa_id');
if (!sErr) {
  const st = {};
  for (const s of stock || []) { const k = s.empresa_id || 'NULL'; st[k] = (st[k] || 0) + 1; }
  console.log('\n== STOCK (filas por empresa) ==');
  for (const [k, v] of Object.entries(st)) console.log(`  ${nombreDe(k)}: ${v}`);
}

console.log('\nOK recon.');
