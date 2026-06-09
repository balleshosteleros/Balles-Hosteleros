// Introspección SOLO LECTURA de tablas de auth (sin volcar PII: solo columnas + valores no sensibles).
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const EMP = 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

for (const t of ['profiles', 'user_roles', 'user_empresas']) {
  const { data, error } = await sb.from(t).select('*').limit(1);
  console.log(`== ${t} ==`, error ? `ERR ${error.message}` : `columnas: ${data[0] ? Object.keys(data[0]).join(', ') : '(tabla vacía)'}`);
}
// valores de role (no PII)
const { data: roles } = await sb.from('user_roles').select('role');
console.log('\nuser_roles.role valores distintos:', [...new Set((roles || []).map((r) => r.role))]);
// nombres de empresa_roles de Bacanal (no PII)
const { data: er } = await sb.from('empresa_roles').select('nombre').eq('empresa_id', EMP);
console.log('empresa_roles de Bacanal:', (er || []).map((r) => r.nombre));
// ¿cuántos directores hay? (conteo, sin datos)
const { count } = await sb.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'director');
console.log('filas user_roles con role=director:', count);
// user_empresas de Bacanal (conteo)
const { count: ue } = await sb.from('user_empresas').select('*', { count: 'exact', head: true }).eq('empresa_id', EMP);
console.log('user_empresas de Bacanal:', ue);
