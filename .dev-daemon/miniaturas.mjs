/**
 * Genera por adelantado las miniaturas que faltan.
 *
 * Los archivos importados de Drive se copian servidor a servidor, así que no
 * traen miniatura: la galería los enseña como cuadros grises hasta que alguien
 * abre cada foto y se genera al vuelo. Con miles de fotos eso es inaceptable,
 * así que se hacen todas de una pasada.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const s3 = new S3Client({
  region: "auto", endpoint: env.R2_ENDPOINT,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const BUCKET = env.R2_BUCKET_NAME;
const EMPRESAS = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const PARALELO = 30;
const MAX_BYTES = 60 * 1024 * 1024;   // igual que el generador del servidor
const log = (m) => {
  const t = new Date().toLocaleTimeString("es-ES");
  console.log(`${t} ${m}`);
  fs.appendFileSync(".dev-daemon/miniaturas.log", `${t} ${m}\n`);
};

for (const empresaId of EMPRESAS.length ? EMPRESAS : ["00000000-0000-0000-0000-000000000001"]) {
  // Solo imágenes que sharp sabe decodificar y que no sean gigantes.
  const pendientes = [];
  for (let d = 0; ; d += 1000) {
    const { data } = await admin.from("documentos")
      .select("id, nombre, r2_key, tipo_mime, tamano_bytes")
      .eq("empresa_id", empresaId).is("miniatura_key", null)
      .like("tipo_mime", "image/%").range(d, d + 999);
    const t = data ?? [];
    for (const r of t) {
      if (/heic|heif|x-adobe-dng|x-canon-cr|x-nikon-nef|tiff/i.test(r.tipo_mime)) continue;
      if ((r.tamano_bytes ?? 0) > MAX_BYTES) continue;
      pendientes.push(r);
    }
    if (t.length < 1000) break;
  }
  // De menor a mayor: las fotos ligeras se procesan enseguida y la galería
  // deja de verse vacía cuanto antes; las pesadas van al final.
  pendientes.sort((a, b) => (a.tamano_bytes ?? 0) - (b.tamano_bytes ?? 0));
  log(`empresa ${empresaId.slice(0, 8)}: ${pendientes.length} miniaturas por generar`);

  let ok = 0, fail = 0;
  for (let i = 0; i < pendientes.length; i += PARALELO) {
    await Promise.all(pendientes.slice(i, i + PARALELO).map(async (doc) => {
      try {
        const key = doc.r2_key.replace(/\.[^./]+$/, "") + "_thumb.jpg";
        const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: doc.r2_key }));
        const buf = Buffer.from(await r.Body.transformToByteArray());
        const th = await sharp(buf)
          .resize(400, 400, { fit: "inside", withoutEnlargement: true })
          .rotate().jpeg({ quality: 75 }).toBuffer();
        await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: th, ContentType: "image/jpeg" }));
        await admin.from("documentos").update({ miniatura_key: key }).eq("id", doc.id);
        ok++;
      } catch { fail++; }
    }));
    if (i % (PARALELO * 20) === 0) log(`  ${ok}/${pendientes.length} (${fail} sin miniatura)`);
  }
  log(`  terminado: ${ok} miniaturas · ${fail} no se pudieron`);
}
log("=== FIN miniaturas");
