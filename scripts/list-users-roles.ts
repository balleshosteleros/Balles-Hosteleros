/**
 * Lista todos los usuarios con su rol_label para auditar antes de borrar
 * los que tengan roles obsoletos.
 *
 * Roles válidos (alineados a departamentos):
 *   Dirección, Gerencia, RRHH, Logística, Cocina, Contabilidad,
 *   Gestoría, Jurídico, Marketing
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ROLES_VALIDOS = new Set([
  "Dirección",
  "Gerencia",
  "RRHH",
  "Logística",
  "Cocina",
  "Contabilidad",
  "Gestoría",
  "Jurídico",
  "Marketing",
]);

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, email, nombre, apellidos, rol_label, empresa_id")
    .order("rol_label", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("❌ Error consultando profiles:", error.message);
    process.exit(1);
  }

  console.log(`\n📊 Total profiles: ${profiles?.length ?? 0}\n`);

  const validos: typeof profiles = [];
  const invalidos: typeof profiles = [];
  const sinRol: typeof profiles = [];

  for (const p of profiles ?? []) {
    if (!p.rol_label || p.rol_label.trim() === "") {
      sinRol.push(p);
    } else if (ROLES_VALIDOS.has(p.rol_label)) {
      validos.push(p);
    } else {
      invalidos.push(p);
    }
  }

  console.log(`✅ VÁLIDOS (${validos.length}):`);
  for (const p of validos) {
    const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ").trim() || "—";
    console.log(`   • ${p.email ?? "—"} (${nombre}) → ${p.rol_label}`);
  }

  console.log(`\n❌ INVÁLIDOS — A BORRAR (${invalidos.length}):`);
  for (const p of invalidos) {
    const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ").trim() || "—";
    console.log(`   • ${p.email ?? "—"} (${nombre}) → ${p.rol_label} [user_id=${p.user_id}]`);
  }

  console.log(`\n⚠️  SIN ROL ASIGNADO (${sinRol.length}):`);
  for (const p of sinRol) {
    const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ").trim() || "—";
    console.log(`   • ${p.email ?? "—"} (${nombre}) [user_id=${p.user_id}]`);
  }

  // Roles únicos vistos
  const rolesVistos = new Set(profiles?.map((p) => p.rol_label).filter(Boolean));
  console.log(`\n📋 Roles únicos en BD: ${[...rolesVistos].join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
