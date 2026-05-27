/**
 * Migra accesos_apps (modelo plano legacy) → apps_externas + app_credenciales + app_credencial_roles.
 *
 * - Crea 1 app por (empresa, nombre).
 * - Solo crea credencial si la fila legacy tiene contrasena no vacía.
 * - Cifra la contrasena con CREDENCIALES_ENCRYPTION_KEY (AES-256-GCM).
 * - Matchea roles_autorizados contra empresa_roles.nombre (case+acentos insensible).
 * - Idempotente: usa UPSERT por (empresa_id, nombre).
 *
 * Uso: npx tsx scripts/migrar-accesos-apps-v2.ts
 */
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";

// Cargar .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) {
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const encKey = process.env.CREDENCIALES_ENCRYPTION_KEY!;

if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
if (!encKey || encKey.length !== 64) {
  throw new Error("CREDENCIALES_ENCRYPTION_KEY ausente o longitud != 64 hex chars");
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function encrypt(plain: string): string {
  const k = Buffer.from(encKey, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}

const CATEGORIA_MAP: Record<string, string> = {
  "SISTEMAS DE GESTION": "Gestión",
  "BANCA Y FINANZAS": "Banca",
  DELIVERY: "Delivery",
  "RRHH": "RRHH",
  "RECURSOS HUMANOS": "RRHH",
  MARKETING: "Marketing",
  COMUNICACION: "Comunicación",
  LOGISTICA: "Logística",
  CONTABILIDAD: "Contabilidad",
};

function mapCategoria(legacy: string): string {
  return CATEGORIA_MAP[normalize(legacy)] ?? "Otros";
}

type Legacy = {
  id: string;
  empresa_id: string;
  nombre: string;
  categoria: string;
  url: string;
  logo_url: string | null;
  notas: string;
  usuario: string;
  contrasena: string;
  roles_autorizados: string[];
};

async function main() {
  console.log("\n→ Leyendo accesos_apps legacy...");
  const { data: legacy, error: legErr } = await supabase
    .from("accesos_apps")
    .select(
      "id, empresa_id, nombre, categoria, url, logo_url, notas, usuario, contrasena, roles_autorizados",
    )
    .not("empresa_id", "is", null);
  if (legErr) {
    console.error("Error leyendo accesos_apps:", legErr.message);
    process.exit(1);
  }

  const filas = (legacy ?? []) as Legacy[];
  console.log(`  ${filas.length} filas legacy con empresa_id`);

  console.log("→ Cargando empresa_roles para mapeo...");
  const { data: rolesData, error: rolesErr } = await supabase
    .from("empresa_roles")
    .select("id, empresa_id, nombre");
  if (rolesErr) {
    console.error("Error leyendo empresa_roles:", rolesErr.message);
    process.exit(1);
  }
  const rolesPorEmpresa = new Map<string, Map<string, string>>();
  for (const r of rolesData ?? []) {
    const empId = r.empresa_id as string;
    if (!rolesPorEmpresa.has(empId)) rolesPorEmpresa.set(empId, new Map());
    rolesPorEmpresa.get(empId)!.set(normalize(r.nombre as string), r.id as string);
  }

  let appsCreadas = 0;
  let appsExistentes = 0;
  let credsCreadas = 0;
  let credsSinPassword = 0;
  let rolesNoEncontrados: string[] = [];

  for (const f of filas) {
    // 1) Upsert app
    const { data: appExistente } = await supabase
      .from("apps_externas")
      .select("id")
      .eq("empresa_id", f.empresa_id)
      .eq("nombre", f.nombre)
      .maybeSingle();

    let appId: string;
    if (appExistente) {
      appId = appExistente.id as string;
      appsExistentes++;
    } else {
      const { data: appNueva, error: appErr } = await supabase
        .from("apps_externas")
        .insert({
          empresa_id: f.empresa_id,
          nombre: f.nombre,
          url: f.url || null,
          logo_url: f.logo_url || null,
          categoria: mapCategoria(f.categoria),
          notas: f.notas ?? "",
        })
        .select("id")
        .single();
      if (appErr || !appNueva) {
        console.error(`  ✗ No se pudo crear app ${f.nombre}:`, appErr?.message);
        continue;
      }
      appId = appNueva.id as string;
      appsCreadas++;
    }

    // 2) Si no hay contraseña, no creamos credencial
    if (!f.contrasena || f.contrasena.trim() === "") {
      credsSinPassword++;
      continue;
    }

    // 3) Match roles
    const rolesMap = rolesPorEmpresa.get(f.empresa_id) ?? new Map();
    const rolIds: string[] = [];
    for (const rolNombre of f.roles_autorizados ?? []) {
      const norm = normalize(rolNombre);
      const rolId = rolesMap.get(norm);
      if (rolId) rolIds.push(rolId);
      else rolesNoEncontrados.push(`${f.nombre} → ${rolNombre}`);
    }

    if (rolIds.length === 0) {
      console.warn(
        `  ⚠ ${f.nombre}: contraseña presente pero sin roles matcheados — credencial NO creada`,
      );
      continue;
    }

    // 4) Crear credencial cifrada
    const passwordCifrado = encrypt(f.contrasena);
    const { data: cred, error: credErr } = await supabase
      .from("app_credenciales")
      .insert({
        app_id: appId,
        empresa_id: f.empresa_id,
        etiqueta: f.nombre,
        usuario: f.usuario || "—",
        password_cifrado: passwordCifrado,
        notas: "(migrado de accesos_apps legacy)",
      })
      .select("id")
      .single();
    if (credErr || !cred) {
      console.error(`  ✗ Credencial ${f.nombre}:`, credErr?.message);
      continue;
    }

    // 5) Insertar roles
    const credId = cred.id as string;
    const { error: rolesInsErr } = await supabase.from("app_credencial_roles").insert(
      rolIds.map((rolId) => ({
        credencial_id: credId,
        rol_id: rolId,
        empresa_id: f.empresa_id,
      })),
    );
    if (rolesInsErr) {
      console.error(`  ✗ Roles de ${f.nombre}:`, rolesInsErr.message);
      continue;
    }
    credsCreadas++;
  }

  console.log("\n=== Resumen ===");
  console.log(`Apps creadas:      ${appsCreadas}`);
  console.log(`Apps ya existían:  ${appsExistentes}`);
  console.log(`Credenciales creadas: ${credsCreadas}`);
  console.log(`Apps sin password (skip credencial): ${credsSinPassword}`);
  if (rolesNoEncontrados.length > 0) {
    console.log(`\n⚠ Roles no matcheados (${rolesNoEncontrados.length}):`);
    const unicos = [...new Set(rolesNoEncontrados)];
    for (const r of unicos.slice(0, 10)) console.log(`   - ${r}`);
    if (unicos.length > 10) console.log(`   ... y ${unicos.length - 10} más`);
  }
  console.log("\n✅ Migración completada.\n");
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
