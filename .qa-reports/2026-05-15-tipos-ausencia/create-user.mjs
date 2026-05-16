import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing env");

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const EMAIL = "qa-test-bh@example.com";
const PASSWORD = "QaTest12345!";
const EMPRESA_ID = "00000000-0000-0000-0000-000000000001";

const { data: existing } = await admin.auth.admin.listUsers();
const prev = existing?.users?.find((u) => u.email === EMAIL);
if (prev) {
  await admin.from("solicitudes_personal").delete().eq("user_id", prev.id);
  await admin.from("profiles").delete().eq("user_id", prev.id);
  await admin.from("user_roles").delete().eq("user_id", prev.id);
  await admin.auth.admin.deleteUser(prev.id);
}

const { data, error } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
});
if (error) throw error;
const userId = data.user.id;

// Un trigger crea el profile al crear el usuario. Actualizamos.
const { error: pErr } = await admin
  .from("profiles")
  .update({
    user_id: userId,
    email: EMAIL,
    nombre: "QA",
    apellidos: "Test",
    empresa_id: EMPRESA_ID,
    estado_acceso: "Activo",
    role: "empleado",
    rol_label: "Empleado",
    departamento: "Sala",
    es_empleado: true,
    avatar_obligatorio: false,
  })
  .eq("id", userId);
if (pErr) {
  console.error("profile update error", pErr);
  throw pErr;
}

// Asegurar que NO tiene rol director/admin (para que se aplique el bloqueo)
await admin.from("user_roles").delete().eq("user_id", userId);

console.log(JSON.stringify({ userId, email: EMAIL, password: PASSWORD, empresaId: EMPRESA_ID }));
