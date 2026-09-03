/**
 * Genera las miniaturas que faltan: FOTOS, VÍDEOS y PDF.
 *
 * Los archivos importados de Drive llegan servidor a servidor, sin pasar por
 * el navegador, así que ninguno trae miniatura y la galería es un muro de
 * iconos grises. Aquí se generan todas de una pasada:
 *
 *  · fotos  -> sharp
 *  · vídeos -> ffmpeg, sacando un fotograma del segundo 1 sin bajar el vídeo
 *              entero (lee del enlace firmado de R2)
 *  · PDF    -> sips, que viene de serie en macOS, rasterizando la 1ª página
 *
 * Nada de esto necesita instalar dependencias nuevas en el proyecto.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const env: Record<string, string> = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
for (const k of Object.keys(env)) process.env[k] = env[k];
const { presignGetR2 } = await import("../src/shared/lib/r2.ts");

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const s3 = new S3Client({
  region: "auto", endpoint: env.R2_ENDPOINT,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const BUCKET = env.R2_BUCKET_NAME;
const LADO = 400, CALIDAD = 75;
const MAX_FOTO = 60 * 1024 * 1024;
const EMPRESAS = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const SOLO = process.env.SOLO ?? "";   // "video" | "foto" | "" (todo)
const PARALELO = Number(process.env.PARALELO ?? 12);
const PARALELO_VIDEO = 4;
const log = (m: string) => {
  const t = new Date().toLocaleTimeString("es-ES");
  console.log(`${t} ${m}`);
  fs.appendFileSync(".dev-daemon/miniaturas.log", `${t} ${m}\n`);
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "thumb-"));

/** Formatos que no se pueden decodificar: RAW de cámara y similares. */
const NO_FOTO = /x-adobe-dng|x-canon-cr|x-nikon-nef|x-sony-arw|tiff/i;
/** Los que sharp no sabe abrir pero `sips` de macOS sí. */
const VIA_SIPS = /heic|heif/i;

async function miniaturaFoto(key: string): Promise<Buffer | null> {
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const buf = Buffer.from(await (r.Body as any).transformToByteArray());
  return sharp(buf).resize(LADO, LADO, { fit: "inside", withoutEnlargement: true })
    .rotate().jpeg({ quality: CALIDAD }).toBuffer();
}

/** Un fotograma del vídeo. ffmpeg lee del enlace firmado: no baja el archivo. */
function miniaturaVideo(key: string): Buffer | null {
  const salida = path.join(tmp, `v${Date.now()}${Math.random()}.jpg`);
  try {
    execFileSync("ffmpeg", ["-y", "-ss", "1", "-i", presignGetR2(key, 900),
      "-frames:v", "1", "-vf", `scale=${LADO}:${LADO}:force_original_aspect_ratio=decrease`,
      "-q:v", "4", salida], { stdio: ["ignore", "ignore", "pipe"], timeout: 180_000 });
    const b = fs.readFileSync(salida);
    fs.unlinkSync(salida);
    return b;
  } catch { try { fs.unlinkSync(salida); } catch {} return null; }
}

/** Con `sips`, nativo de macOS: vale para PDF (1ª página) y para HEIC. */
async function miniaturaSips(key: string, ext: string): Promise<Buffer | null> {
  const origen = path.join(tmp, `p${Date.now()}${Math.random()}${ext}`);
  const salida = origen.replace(new RegExp(`\\${ext}$`), ".jpg");
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    fs.writeFileSync(origen, Buffer.from(await (r.Body as any).transformToByteArray()));
    execFileSync("sips", ["-s", "format", "jpeg", "-Z", String(LADO), origen, "--out", salida],
      { stdio: ["ignore", "ignore", "pipe"], timeout: 60_000 });
    const b = fs.readFileSync(salida);
    return b;
  } catch { return null; }
  finally { for (const f of [origen, salida]) { try { fs.unlinkSync(f); } catch {} } }
}

for (const empresaId of EMPRESAS) {
  const pendientes: any[] = [];
  for (let d = 0; ; d += 1000) {
    const { data } = await admin.from("documentos")
      .select("id, nombre, r2_key, tipo_mime, tamano_bytes")
      .eq("empresa_id", empresaId).is("miniatura_key", null).range(d, d + 999);
    const t = data ?? [];
    for (const r of t) {
      const m = (r.tipo_mime as string) ?? "";
      const grande = (r.tamano_bytes ?? 0) > MAX_FOTO;
      const esHeic = m.startsWith("image/") && VIA_SIPS.test(m) && !grande;
      const esFoto = m.startsWith("image/") && !NO_FOTO.test(m) && !VIA_SIPS.test(m) && !grande;
      const esVideo = m.startsWith("video/");
      const esPdf = m === "application/pdf";
      if (esFoto || esVideo || esPdf || esHeic) {
        const clase = esFoto ? "foto" : esVideo ? "video" : esHeic ? "heic" : "pdf";
        if (SOLO === "video" && clase !== "video") continue;
        if (SOLO === "foto" && clase === "video") continue;
        pendientes.push({ ...r, clase });
      }
    }
    if (t.length < 1000) break;
  }
  // Las ligeras primero: la galería se llena antes.
  pendientes.sort((a, b) => (a.tamano_bytes ?? 0) - (b.tamano_bytes ?? 0));
  const n = (c: string) => pendientes.filter((p) => p.clase === c).length;
  log(`${empresaId.slice(0, 8)}: ${pendientes.length} pendientes (${n("foto")} fotos, ${n("heic")} heic, ${n("video")} vídeos, ${n("pdf")} pdf)`);

  let ok = 0, fail = 0;
  // Fotos y PDF primero (rápidos, solo descarga); los vídeos después y de
  // menos en menos, porque cada ffmpeg abre su propia conexión y en bloque
  // saturaban la red y se pasaban de tiempo.
  const orden = [...pendientes.filter((p) => p.clase !== "video"),
                 ...pendientes.filter((p) => p.clase === "video")];
  for (let i = 0; i < orden.length; ) {
    const lote = orden[i].clase === "video" ? PARALELO_VIDEO : PARALELO;
    await Promise.all(orden.slice(i, i + lote).map(async (doc) => {
      try {
        const th = doc.clase === "foto" ? await miniaturaFoto(doc.r2_key)
          : doc.clase === "video" ? miniaturaVideo(doc.r2_key)
          : doc.clase === "heic" ? await miniaturaSips(doc.r2_key, ".heic")
          : await miniaturaSips(doc.r2_key, ".pdf");
        if (!th) { fail++; return; }
        const key = doc.r2_key.replace(/\.[^./]+$/, "") + "_thumb.jpg";
        await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: th, ContentType: "image/jpeg" }));
        await admin.from("documentos").update({ miniatura_key: key }).eq("id", doc.id);
        ok++;
      } catch (e: any) { fail++; if (fail <= 3) log(`  ! ${doc.nombre}: ${String(e?.message ?? e).slice(0, 160)}`); }
    }));
    i += lote;
    if (ok % 50 < lote) log(`  ${ok}/${orden.length} (${fail} sin miniatura)`);
  }
  log(`  ${empresaId.slice(0, 8)} terminado: ${ok} miniaturas · ${fail} no se pudieron`);
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
log("=== FIN miniaturas");
