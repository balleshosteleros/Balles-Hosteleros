// Prueba SOLO LECTURA de la Management API + columnas de profiles (sin PII).
import { readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('Falta SUPABASE_ACCESS_TOKEN'); process.exit(2); }

async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }),
  });
  const t = await r.text();
  let body; try { body = JSON.parse(t); } catch { body = t; }
  return { status: r.status, body };
}

console.log('project ref:', ref);
console.log('\n-- existen las tablas? --');
console.log(JSON.stringify((await sql("select to_regclass('public.profiles')::text as profiles, to_regclass('public.user_roles')::text as user_roles, to_regclass('public.user_empresas')::text as user_empresas;")).body));
console.log('\n-- columnas de profiles --');
const cols = await sql("select column_name, is_nullable, data_type from information_schema.columns where table_schema='public' and table_name='profiles' order by ordinal_position;");
console.log(JSON.stringify(cols.body));
console.log('\n-- enum app_role --');
console.log(JSON.stringify((await sql("select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='app_role' order by e.enumsortorder;")).body));
