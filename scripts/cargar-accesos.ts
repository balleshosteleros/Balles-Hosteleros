/**
 * Carga puntual de credenciales en el módulo seguro de Accesos.
 * Escribe en la tabla UNIFICADA `accesos_apps` (columna jsonb `accesos`).
 *
 * ── CÓMO FUNCIONA ────────────────────────────────────────────
 *   1. Lee la clave de cifrado y las credenciales de Supabase de .env.local
 *      (las mismas que usa la app). Nada se escribe en el repo.
 *   2. Lee tu archivo LOCAL de datos:  scripts/accesos-datos.local.json
 *      (ese archivo lo creas TÚ, contiene las contraseñas EN CLARO y está
 *       en .gitignore: NUNCA se sube al repositorio).
 *   3. Por cada empresa y app: si la app ya existe (mismo nombre, normalizado)
 *      se ACTUALIZA su array `accesos`; si no existe, se CREA con un id corto
 *      `<pref>-xxN`. Cifra contraseñas y datos extra (AES-256-GCM) y asigna
 *      los ROLES VISIBLES de cada credencial.
 *   4. Al terminar, BORRA tú el archivo accesos-datos.local.json.
 *
 * ── USO ──────────────────────────────────────────────────────
 *   1. Copia la plantilla:
 *        cp scripts/accesos-datos.plantilla.json scripts/accesos-datos.local.json
 *   2. Rellena scripts/accesos-datos.local.json con tus contraseñas (del PDF).
 *   3. Ejecuta:
 *        npx tsx scripts/cargar-accesos.ts
 *      (añade  --dry  para simular sin escribir nada)
 *   4. Borra el archivo local:
 *        rm scripts/accesos-datos.local.json
 *
 * Requiere en .env.local:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CREDENCIALES_ENCRYPTION_KEY (64 hex).
 */
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";

// ── Cargar .env.local ────────────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const DRY = process.argv.includes("--dry");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const encKeyHex = process.env.CREDENCIALES_ENCRYPTION_KEY?.trim();

if (!url || !key) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
if (!encKeyHex || encKeyHex.length !== 64) {
  console.error("❌ CREDENCIALES_ENCRYPTION_KEY ausente o no es de 64 caracteres hex.");
  console.error("   Genera una con:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
  process.exit(1);
}

const ENC_KEY = Buffer.from(encKeyHex, "hex");

// ── Cifrado idéntico al de la app (src/features/accesos/lib/crypto.ts) ──
function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}
function encOpt(s: string): string {
  return s && s.length > 0 ? encrypt(s) : "";
}

// Normaliza un nombre de app para comparar (sin acentos, minúsculas, sin espacios extra).
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ── Tipos del archivo de datos ───────────────────────────────
type DatoExtra = { nombre: string; valor: string };
type CredData = {
  etiqueta: string;
  usuario?: string;
  password?: string;
  notas?: string;
  datos_extra?: DatoExtra[];
  /** Nombres EXACTOS de roles (empresa_roles.nombre) que pueden verla. */
  roles: string[];
};
type AppData = {
  nombre: string;
  url?: string;
  icono?: string;
  logo_url?: string;
  categoria: string;
  notas?: string;
  credenciales: CredData[];
};
type EmpresaData = {
  /** slug o nombre exacto de la empresa (se resuelve por ambos). */
  empresa: string;
  /** prefijo para ids nuevos (p.ej. "ba" para bacanal). */
  prefijo_id: string;
  apps: AppData[];
};

// ── Cargar archivo local ─────────────────────────────────────
const datosPath = path.resolve(process.cwd(), "scripts/accesos-datos.local.json");
if (!fs.existsSync(datosPath)) {
  console.error("❌ No existe scripts/accesos-datos.local.json");
  console.error("   Copia la plantilla:  cp scripts/accesos-datos.plantilla.json scripts/accesos-datos.local.json");
  process.exit(1);
}
const datos: EmpresaData[] = JSON.parse(fs.readFileSync(datosPath, "utf-8"));

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(DRY ? "🧪 MODO SIMULACIÓN (no se escribe nada)\n" : "🔒 Cargando accesos cifrados en accesos_apps...\n");
  let totalAppsCreadas = 0;
  let totalAppsActualizadas = 0;
  let totalCreds = 0;
  const avisos: string[] = [];

  for (const emp of datos) {
    // Resolver empresa por slug o nombre.
    const { data: empresa } = await supabase
      .from("empresas")
      .select("id, nombre, slug")
      .or(`slug.eq.${emp.empresa},nombre.eq.${emp.empresa}`)
      .maybeSingle();
    if (!empresa) {
      avisos.push(`⚠️  Empresa no encontrada: "${emp.empresa}" — omitida.`);
      continue;
    }
    console.log(`🏢 ${empresa.nombre} (${empresa.id})`);

    // Roles válidos de la empresa (para validar rol visible).
    const { data: roles } = await supabase
      .from("empresa_roles")
      .select("nombre")
      .eq("empresa_id", empresa.id);
    const rolesValidos = new Set((roles ?? []).map((r) => r.nombre.trim().toUpperCase()));

    // Apps existentes de la empresa (para upsert por nombre normalizado).
    const { data: existentes } = await supabase
      .from("accesos_apps")
      .select("id, nombre")
      .eq("empresa_slug", emp.empresa);
    const idPorNombre = new Map<string, string>();
    const idsUsados = new Set<string>();
    for (const a of existentes ?? []) {
      idPorNombre.set(norm(a.nombre), a.id);
      idsUsados.add(a.id);
    }

    let contadorId = 1;
    function nuevoId(): string {
      let id = `${emp.prefijo_id}-x${contadorId++}`;
      while (idsUsados.has(id)) id = `${emp.prefijo_id}-x${contadorId++}`;
      idsUsados.add(id);
      return id;
    }

    for (const app of emp.apps) {
      // Construir array de accesos cifrados.
      const accesos: unknown[] = [];
      for (const c of app.credenciales) {
        const rolesCred: string[] = [];
        for (const rn of c.roles) {
          if (rolesValidos.has(rn.trim().toUpperCase())) rolesCred.push(rn.trim());
          else avisos.push(`⚠️  [${empresa.nombre}] "${app.nombre}/${c.etiqueta}": rol "${rn}" no existe en la empresa.`);
        }
        if (rolesCred.length === 0) {
          avisos.push(`⛔ [${empresa.nombre}] "${app.nombre}/${c.etiqueta}": sin ROL válido — credencial OMITIDA.`);
          continue;
        }
        const datosExtra = (c.datos_extra ?? [])
          .filter((d) => d.nombre?.trim() && d.valor?.length)
          .map((d) => ({ nombre: d.nombre.trim(), valor_cifrado: encOpt(d.valor) }));

        accesos.push({
          etiqueta: c.etiqueta,
          usuario: c.usuario ?? "",
          contrasena: encOpt(c.password ?? ""),
          roles: rolesCred,
          notas: c.notas ?? "",
          datos_extra: datosExtra,
        });
        totalCreds++;
      }

      if (accesos.length === 0) {
        avisos.push(`⚠️  [${empresa.nombre}] app "${app.nombre}" sin credenciales válidas — omitida.`);
        continue;
      }

      // Roles autorizados de la app = unión de roles de sus credenciales.
      const rolesApp = Array.from(
        new Set(accesos.flatMap((a: any) => a.roles as string[])),
      );
      // Compat legacy: usuario/contrasena = primera credencial.
      const primera: any = accesos[0];

      const existeId = idPorNombre.get(norm(app.nombre));
      const fila = {
        empresa_slug: emp.empresa,
        empresa_id: empresa.id,
        nombre: app.nombre,
        descripcion: "",
        url: app.url ?? "",
        icono: app.icono ?? "🔗",
        logo_url: app.logo_url ?? null,
        categoria: app.categoria,
        departamentos: [] as string[],
        roles_autorizados: rolesApp,
        usuario: primera.usuario,
        contrasena: primera.contrasena,
        estado: "Activo",
        responsable: "",
        notas: app.notas ?? "",
        tipo_integracion: "enlace",
        accesos,
        updated_at: new Date().toISOString(),
      };

      if (existeId) {
        totalAppsActualizadas++;
        console.log(`   ♻️  ${app.nombre}  (${accesos.length} cred.)  [actualiza ${existeId}]`);
        if (!DRY) {
          const { error } = await supabase.from("accesos_apps").update(fila).eq("id", existeId);
          if (error) avisos.push(`⚠️  update "${app.nombre}": ${error.message}`);
        }
      } else {
        const id = nuevoId();
        totalAppsCreadas++;
        console.log(`   ✨ ${app.nombre}  (${accesos.length} cred.)  [crea ${id}]`);
        if (!DRY) {
          const { error } = await supabase.from("accesos_apps").insert({ id, ...fila });
          if (error) avisos.push(`⚠️  insert "${app.nombre}": ${error.message}`);
        }
      }
    }
    console.log("");
  }

  console.log("─".repeat(50));
  console.log(
    `${DRY ? "Simulado" : "Cargado"}: ${totalAppsCreadas} apps creadas, ${totalAppsActualizadas} actualizadas, ${totalCreds} credenciales.`,
  );
  if (avisos.length) {
    console.log("\nAvisos:");
    for (const a of avisos) console.log("  " + a);
  }
  if (!DRY) {
    console.log("\n🧹 IMPORTANTE: borra ahora el archivo de datos:");
    console.log("   rm scripts/accesos-datos.local.json");
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
