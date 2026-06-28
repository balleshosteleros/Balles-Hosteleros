/**
 * Carga puntual de credenciales en el módulo seguro de Accesos.
 *
 * ── CÓMO FUNCIONA ────────────────────────────────────────────
 *   1. Lee la clave de cifrado y las credenciales de Supabase de .env.local
 *      (las mismas que usa la app). Nada se escribe en el repo.
 *   2. Lee tu archivo LOCAL de datos:  scripts/accesos-datos.local.json
 *      (ese archivo lo creas TÚ, contiene las contraseñas EN CLARO y está
 *       en .gitignore: NUNCA se sube al repositorio).
 *   3. Por cada empresa: crea las apps, cifra las contraseñas y datos extra
 *      (AES-256-GCM), y asigna el ROL VISIBLE de cada credencial.
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

// ── Tipos del archivo de datos ───────────────────────────────
type DatoExtra = { nombre: string; valor: string };
type CredData = {
  etiqueta: string;
  usuario?: string;
  password?: string;
  url_especifica?: string;
  notas?: string;
  rol_responsable?: string;
  datos_extra?: DatoExtra[];
  /** Nombres EXACTOS de roles (empresa_roles.nombre) que pueden verla. */
  rol_visible: string[];
};
type AppData = {
  nombre: string;
  url?: string;
  logo_url?: string;
  categoria: string;
  notas?: string;
  credenciales: CredData[];
};
type EmpresaData = {
  /** slug o nombre exacto de la empresa (se resuelve por ambos). */
  empresa: string;
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
  console.log(DRY ? "🧪 MODO SIMULACIÓN (no se escribe nada)\n" : "🔒 Cargando accesos cifrados...\n");
  let totalApps = 0;
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

    // Mapa de roles de la empresa por nombre (normalizado).
    const { data: roles } = await supabase
      .from("empresa_roles")
      .select("id, nombre")
      .eq("empresa_id", empresa.id);
    const rolPorNombre = new Map<string, string>();
    for (const r of roles ?? []) rolPorNombre.set(r.nombre.trim().toUpperCase(), r.id);

    for (const app of emp.apps) {
      totalApps++;
      let appId = "(dry)";
      if (!DRY) {
        const { data: appRow, error: appErr } = await supabase
          .from("apps_externas")
          .insert({
            empresa_id: empresa.id,
            nombre: app.nombre,
            url: app.url || null,
            logo_url: app.logo_url || null,
            categoria: app.categoria,
            notas: app.notas ?? "",
          })
          .select("id")
          .single();
        if (appErr || !appRow) {
          avisos.push(`⚠️  [${empresa.nombre}] app "${app.nombre}": ${appErr?.message}`);
          continue;
        }
        appId = appRow.id;
      }
      console.log(`   📱 ${app.nombre}  (${app.credenciales.length} cred.)`);

      for (const c of app.credenciales) {
        // Resolver ROL VISIBLE a ids.
        const rolesIds: string[] = [];
        for (const rn of c.rol_visible) {
          const id = rolPorNombre.get(rn.trim().toUpperCase());
          if (id) rolesIds.push(id);
          else avisos.push(`⚠️  [${empresa.nombre}] "${app.nombre}/${c.etiqueta}": rol visible "${rn}" no existe.`);
        }
        if (rolesIds.length === 0) {
          avisos.push(`⛔ [${empresa.nombre}] "${app.nombre}/${c.etiqueta}": sin ROL VISIBLE válido — credencial OMITIDA.`);
          continue;
        }

        const datosExtra = (c.datos_extra ?? [])
          .filter((d) => d.nombre?.trim() && d.valor?.length)
          .map((d) => ({ nombre: d.nombre.trim(), valor_cifrado: encOpt(d.valor) }));

        totalCreds++;
        if (DRY) {
          console.log(`      ✓ ${c.etiqueta}  → ve: [${c.rol_visible.join(", ")}]  extra: ${datosExtra.length}`);
          continue;
        }

        const { data: credRow, error: credErr } = await supabase
          .from("app_credenciales")
          .insert({
            app_id: appId,
            empresa_id: empresa.id,
            etiqueta: c.etiqueta,
            usuario: c.usuario ?? "",
            password_cifrado: encOpt(c.password ?? ""),
            url_especifica: c.url_especifica || null,
            notas: c.notas ?? "",
            rol_responsable: c.rol_responsable ?? "",
            datos_extra: datosExtra,
          })
          .select("id")
          .single();
        if (credErr || !credRow) {
          avisos.push(`⚠️  [${empresa.nombre}] "${app.nombre}/${c.etiqueta}": ${credErr?.message}`);
          continue;
        }
        const { error: rolErr } = await supabase.from("app_credencial_roles").insert(
          rolesIds.map((rid) => ({ credencial_id: credRow.id, rol_id: rid, empresa_id: empresa.id })),
        );
        if (rolErr) avisos.push(`⚠️  roles de "${c.etiqueta}": ${rolErr.message}`);
        console.log(`      ✓ ${c.etiqueta}  → ve: [${c.rol_visible.join(", ")}]`);
      }
    }
    console.log("");
  }

  console.log("─".repeat(50));
  console.log(`${DRY ? "Simulado" : "Cargado"}: ${totalApps} apps, ${totalCreds} credenciales.`);
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
