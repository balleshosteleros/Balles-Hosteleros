// Introspección SOLO LECTURA del modelo de auth real (usuarios/usuario_roles/usuario_empresas)
// vía Management API. Sin PII (solo estructura).
import { readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
async function sql(q) { const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }); let b; const t = await r.text(); try { b = JSON.parse(t); } catch { b = t; } return b; }

console.log('== usuarios: columnas NOT NULL (las obligatorias al insertar) ==');
console.log(JSON.stringify(await sql("select column_name, data_type, column_default from information_schema.columns where table_schema='public' and table_name='usuarios' and is_nullable='NO' order by ordinal_position;")));
console.log('\n== usuario_roles: columnas + constraints ==');
console.log(JSON.stringify(await sql("select column_name, is_nullable from information_schema.columns where table_schema='public' and table_name='usuario_roles' order by ordinal_position;")));
console.log(JSON.stringify(await sql("select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.usuario_roles'::regclass;")));
console.log('\n== usuario_empresas: constraints ==');
console.log(JSON.stringify(await sql("select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='public.usuario_empresas'::regclass;")));
console.log('\n== enums relevantes (role/estado/acceso) ==');
console.log(JSON.stringify(await sql("select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typname ~* 'role|estado|acceso' order by t.typname, e.enumsortorder;")));
console.log('\n== trigger(s) en auth.users (¿crea fila en usuarios al alta?) ==');
console.log(JSON.stringify(await sql("select tgname, pg_get_triggerdef(oid) as def from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal;")));
console.log('\n== def de handle_new_user (si existe) ==');
console.log(JSON.stringify(await sql("select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='handle_new_user' limit 1;")));
