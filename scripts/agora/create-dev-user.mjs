// Crea (o repara) un login de DEMO con acceso director a BACANAL para ver Logística.
// Usa admin API (auth) + Management API (tablas usuarios/usuario_roles/usuario_empresas).
// Idempotente: si el usuario ya existe, resetea su contraseña y reconfigura.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
function loadEnv() { const p = resolve(process.cwd(), '.env.local'); for (const line of readFileSync(p, 'utf-8').split('\n')) { const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } }
loadEnv();

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ref = new URL(SUPA_URL).hostname.split('.')[0];
const token = process.env.SUPABASE_ACCESS_TOKEN;
const EMP = 'fe2ea3c4-aa28-41ce-a135-bf196ab5dc47'; // BACANAL
const EMAIL = 'agora.demo@balleshosteleros.com';
const PASSWORD = 'AgoraDemo2026';

async function sql(q) { const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) }); let b; const t = await r.text(); try { b = JSON.parse(t); } catch { b = t; } return { status: r.status, body: b }; }

const admin = createClient(SUPA_URL, SRK, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. Crear (o localizar) el usuario auth
let uid;
const { data: created, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Agora Demo' } });
if (error) {
  console.log('createUser:', error.message, '→ buscando si ya existe...');
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = (list?.users || []).find((u) => u.email === EMAIL);
  if (!found) throw error;
  uid = found.id;
  await admin.auth.admin.updateUserById(uid, { password: PASSWORD, email_confirm: true });
  console.log('usuario ya existía, contraseña reseteada. uid:', uid);
} else {
  uid = created.user.id;
  console.log('usuario creado. uid:', uid);
}

// 2. Configurar usuarios + roles + empresa (vía Management API, postgres)
const cfg = await sql(
  // Esquema actual (jul-2026): roles = usuarios.rol_id/rol_label (usuario_roles ya no existe);
  // el guard de login exige ademas estado_acceso='Activo' y password_set=true.
  `update public.usuarios set empresa_id='${EMP}', rol_id='68f38ba5-a51d-4b06-a6a5-7f3c233a1ab1',
     rol_label='DIRECCIÓN', estado_acceso='Activo', password_set=true, es_empleado=false
   where user_id='${uid}';` +
  `insert into public.usuario_empresas (user_id, empresa_id) values ('${uid}','${EMP}') on conflict do nothing;`
);
console.log('config SQL:', cfg.status, JSON.stringify(cfg.body));

// 3. Verificación
const ver = await sql(`select
  (select empresa_id::text from public.usuarios where user_id='${uid}') as empresa_usuarios,
  (select rol_label from public.usuarios where user_id='${uid}') as rol,
  (select count(*) from public.usuario_empresas where user_id='${uid}' and empresa_id='${EMP}') as en_usuario_empresas;`);
console.log('verificación:', JSON.stringify(ver.body));

console.log('\n=========== CREDENCIALES DEMO (Bacanal / director) ===========');
console.log('  URL:      http://localhost:3001');
console.log('  email:   ', EMAIL);
console.log('  password:', PASSWORD);
console.log('==============================================================');
console.log('(usuario de demo, borrable luego: scripts/agora/delete-dev-user.mjs)');
