// Comprobación del espejo de stock de Bacanal (solo lectura).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const EMP = 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: top } = await sb.from('stock').select('producto_nombre, cantidad_actual').eq('empresa_id', EMP).order('cantidad_actual', { ascending: false }).limit(12);
console.log('— Top stock Bacanal (reflejado de Ágora) —');
for (const s of top) console.log(`   ${String(s.cantidad_actual).padStart(8)}  ${s.producto_nombre}`);

const { data: neg } = await sb.from('stock').select('producto_nombre, cantidad_actual').eq('empresa_id', EMP).lt('cantidad_actual', 0).order('cantidad_actual', { ascending: true }).limit(8);
console.log(`\n— Stock negativo (Ágora sin regularizar): ${neg.length} —`);
for (const s of neg) console.log(`   ${String(s.cantidad_actual).padStart(8)}  ${s.producto_nombre}`);

const { count: creados } = await sb.from('productos').select('*', { count: 'exact', head: true }).eq('empresa_id', EMP).eq('observaciones', 'Importado de Agora (espejo stock) 2026-06-09');
const { count: total } = await sb.from('productos').select('*', { count: 'exact', head: true }).eq('empresa_id', EMP);
console.log(`\nProductos creados por el import: ${creados} · total productos Bacanal ahora: ${total}`);
