// Runner de SQL vía Management API. Lee la query de un fichero. Uso: node mgmt-run.mjs <file.sql>
import { readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const q = readFileSync(process.argv[2], 'utf-8');
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
const t = await r.text(); let b; try { b = JSON.parse(t); } catch { b = t; }
console.log('HTTP', r.status);
console.log(typeof b === 'string' ? b : JSON.stringify(b, null, 2));
