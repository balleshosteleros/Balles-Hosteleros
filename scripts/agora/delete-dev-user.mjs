// Borra el usuario de demo (agora.demo@balleshosteleros.com). Cascada limpia roles/empresas.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();
const EMAIL = 'agora.demo@balleshosteleros.com';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
const found = (list?.users || []).find((u) => u.email === EMAIL);
if (!found) { console.log('no existe', EMAIL); process.exit(0); }
const { error } = await admin.auth.admin.deleteUser(found.id);
console.log(error ? 'error: ' + error.message : `usuario demo borrado: ${EMAIL} (${found.id})`);
