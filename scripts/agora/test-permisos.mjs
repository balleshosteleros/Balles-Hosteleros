// Replica lo que hace getUserPermisos (vía REST/PostgREST) para el usuario demo.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const UID = '121cca3f-b55d-4248-bd60-efb00f29e66a';

const u = await sb.from('usuarios').select('rol_label, empresa_id, departamento').eq('user_id', UID).maybeSingle();
console.log('usuarios (REST):', u.error ? 'ERR -> ' + u.error.message : JSON.stringify(u.data));

const r = await sb.from('usuario_roles').select('role').eq('user_id', UID);
console.log('usuario_roles (REST):', r.error ? 'ERR -> ' + r.error.message : JSON.stringify(r.data));

const ue = await sb.from('usuario_empresas').select('empresa_id').eq('user_id', UID);
console.log('usuario_empresas (REST):', ue.error ? 'ERR -> ' + ue.error.message : JSON.stringify(ue.data));
