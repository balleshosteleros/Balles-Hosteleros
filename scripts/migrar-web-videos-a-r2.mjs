/**
 * Migra los vídeos pesados de las webs públicas de Supabase Storage a R2.
 *
 * Motivo: R2 tiene egress gratis y Supabase no. Los mp4 del hero se sirven a
 * cada visitante de la web pública, así que son justo el tipo de dato que la
 * arquitectura manda a R2 (igual que grabaciones y formación).
 *
 * Idempotente: si el objeto ya está en R2 con el mismo tamaño, no lo resube.
 * NO borra nada del bucket de Supabase (eso se decide después de verificar).
 */
import { readFileSync } from "node:fs";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

// --- Cargar .env.local a mano (el script corre fuera de Next) ---
for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const {
  R2_BUCKET_NAME: BUCKET,
  R2_PUBLIC_URL: PUBLIC_URL,
  R2_ENDPOINT: ENDPOINT,
  R2_ACCESS_KEY_ID: KEY,
  R2_SECRET_ACCESS_KEY: SECRET,
  NEXT_PUBLIC_SUPABASE_URL: SB_URL,
  SUPABASE_SERVICE_ROLE_KEY: SB_KEY,
} = process.env;

if (!BUCKET || !PUBLIC_URL || !ENDPOINT || !KEY || !SECRET) throw new Error("Faltan R2_*");
if (!SB_URL || !SB_KEY) throw new Error("Faltan credenciales de Supabase");

const r2 = new S3Client({
  region: "auto",
  endpoint: ENDPOINT,
  credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
});
const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const DRY = process.argv.includes("--dry");

/** Vídeos referenciados por cualquier bloque de cualquier página publicada. */
const { data: paginas, error } = await sb
  .from("paginas_web")
  .select("id, empresa_id, nombre, bloques");
if (error) throw new Error(`Supabase: ${error.message}`);

const esVideoSupabase = (u) =>
  typeof u === "string" && u.includes("/storage/v1/object/public/") && /\.(mp4|webm|mov)$/i.test(u);

let migrados = 0;
let saltados = 0;

for (const pagina of paginas ?? []) {
  const bloques = Array.isArray(pagina.bloques) ? pagina.bloques : [];
  let cambiado = false;

  for (const bloque of bloques) {
    const url = bloque?.datos?.video_url;
    if (!esVideoSupabase(url)) continue;

    const nombreArchivo = decodeURIComponent(url.split("/").pop().split("?")[0]);
    const key = `empresa_${pagina.empresa_id}/web/${nombreArchivo}`;
    const destino = `${PUBLIC_URL}/${key}`;

    // Descargar el original de Supabase.
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ✗ no se pudo leer ${url} (HTTP ${res.status})`);
      continue;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "video/mp4";

    // ¿Ya está en R2 con el mismo tamaño? Entonces no se resube.
    let yaEsta = false;
    try {
      const head = await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      yaEsta = head.ContentLength === buffer.length;
    } catch { /* no existe */ }

    if (yaEsta) {
      console.log(`  = ya en R2: ${key} (${(buffer.length / 1e6).toFixed(2)} MB)`);
      saltados++;
    } else if (DRY) {
      console.log(`  → [dry] subiría ${key} (${(buffer.length / 1e6).toFixed(2)} MB)`);
    } else {
      await r2.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          // Un año inmutable: el nombre del archivo cambia si cambia el vídeo.
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
      console.log(`  ✓ subido ${key} (${(buffer.length / 1e6).toFixed(2)} MB)`);
      migrados++;
    }

    if (bloque.datos.video_url !== destino) {
      bloque.datos.video_url = destino;
      cambiado = true;
    }
  }

  if (cambiado && !DRY) {
    const { error: errUpd } = await sb
      .from("paginas_web")
      .update({ bloques })
      .eq("id", pagina.id);
    if (errUpd) console.error(`  ✗ no se pudo guardar "${pagina.nombre}": ${errUpd.message}`);
    else console.log(`  ✓ "${pagina.nombre}" apunta ya a R2`);
  } else if (cambiado) {
    console.log(`  → [dry] "${pagina.nombre}" pasaría a apuntar a R2`);
  }
}

console.log(`\nSubidos: ${migrados} · Ya estaban: ${saltados}`);
