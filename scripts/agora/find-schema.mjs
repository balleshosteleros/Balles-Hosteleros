import { readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
async function sql(q) { const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }); let b; const t = await r.text(); try { b = JSON.parse(t); } catch { b = t; } return b; }

console.log('-- en qué schema viven? --');
console.log(JSON.stringify(await sql("select table_schema, table_name from information_schema.tables where table_name in ('profiles','user_roles','user_empresas','empresa_roles') order by table_name, table_schema;")));
console.log('\n-- columnas de profiles (cualquier schema) --');
console.log(JSON.stringify(await sql("select table_schema, column_name, is_nullable from information_schema.columns where table_name='profiles' order by table_schema, ordinal_position;")));
