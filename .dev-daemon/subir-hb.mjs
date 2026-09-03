/**
 * Sube a R2 los archivos que faltan, leyéndolos del Drive montado en el Mac.
 *
 * El importador normal va por la API de Drive y necesita el servidor Next en
 * pie. Con la fecha límite encima y el servidor sin compilar, esto hace el
 * mismo trabajo por el camino corto: disco -> R2 -> fila en `documentos`.
 * Replica la estructura de carpetas igual que el importador.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { execFileSync } from "node:child_process";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const s3 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});
const BUCKET = env.R2_BUCKET_NAME;
const USER = "59c496f2-9bc8-4a0b-9004-c3b2770d8982";
const HOME = process.env.HOME;

const OBJETIVOS = [
  {
    nombre: "HABANA",
    empresaId: "00000000-0000-0000-0000-000000000001",
    raizLocal: `${HOME}/Library/CloudStorage/GoogleDrive-direccion.grupohabana@gmail.com/Mi unidad/6.MARKETING HABANA`,
    carpetaDestino: "d064cdc9-4eca-4f60-abe9-ab07b14a1385",
    departamento: "MARKETING",
  },
  {
    nombre: "BACANAL",
    empresaId: "fe2ea3c4-aa28-41ce-a135-bf196ab5dc47",
    raizLocal: `${HOME}/Library/CloudStorage/GoogleDrive-direccion.grupobacanal@gmail.com/Mi unidad/6.MARKETING BACANAL`,
    carpetaDestino: "841f6718-0020-4a7a-8bca-f8b3994c7991",
    departamento: "MARKETING",
  },
  // BALLES NO va aquí: lo sube otra ventana con su propio proceso sobre
  // `subir-local.mjs`. Este fichero es solo de HABANA y BACANAL, aparte para
  // que las dos ventanas no se pisen el mismo script.
];

const PARALELO = Number(process.env.PARALELO ?? 8);
const log = (m) => {
  const t = new Date().toLocaleTimeString("es-ES");
  console.log(`${t} ${m}`);
  fs.appendFileSync(".dev-daemon/subida-hb.log", `${t} ${m}\n`);
};

/** El id de Drive de un archivo local, para no volver a traer lo ya copiado. */
function idDrive(p) {
  try {
    return execFileSync("xattr", ["-p", "com.google.drivefs.item-id#S", p], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch { return null; }
}

function listar(dir, out = []) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listar(p, out);
    else if (e.isFile() && e.name !== ".DS_Store") out.push(p);
  }
  return out;
}

const MIMES = {
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/x-m4v",
  ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".gif": "image/gif", ".webp": "image/webp", ".heic": "image/heic",
  ".pdf": "application/pdf", ".zip": "application/zip",
  ".psd": "image/vnd.adobe.photoshop", ".ai": "application/postscript",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".txt": "text/plain",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/** Crea (o reutiliza) la carpeta destino, replicando el árbol local. */
const cacheCarpetas = new Map();
async function asegurarCarpeta(empresaId, padreId, depto, nombre) {
  const clave = `${padreId}|${nombre.toLowerCase()}`;
  if (cacheCarpetas.has(clave)) return cacheCarpetas.get(clave);
  const { data: ex } = await admin.from("carpetas_documentos").select("id")
    .eq("empresa_id", empresaId).eq("parent_id", padreId).ilike("nombre", nombre).maybeSingle();
  if (ex) { cacheCarpetas.set(clave, ex.id); return ex.id; }
  const { data, error } = await admin.from("carpetas_documentos")
    .insert({ empresa_id: empresaId, parent_id: padreId, nombre, departamento: depto, es_raiz: false, created_by: USER })
    .select("id").single();
  if (error) {
    // Otra subida en paralelo creó la misma carpeta un instante antes: no es
    // un fallo, es la carrera esperable al subir de ocho en ocho. Se relee.
    if (error.code === "23505") {
      const { data: ya } = await admin.from("carpetas_documentos").select("id")
        .eq("empresa_id", empresaId).eq("parent_id", padreId).ilike("nombre", nombre).maybeSingle();
      if (ya) { cacheCarpetas.set(clave, ya.id); return ya.id; }
    }
    throw error;
  }
  cacheCarpetas.set(clave, data.id);
  return data.id;
}

async function carpetaPara(obj, rutaRelativa) {
  let padre = obj.carpetaDestino;
  for (const tramo of rutaRelativa.split(path.sep).filter(Boolean)) {
    padre = await asegurarCarpeta(obj.empresaId, padre, obj.departamento, tramo);
  }
  return padre;
}

// SOLO=BALLES migra una empresa sin tocar las otras dos, que van por su cuenta.
const soloNombre = process.env.SOLO;
const aMigrar = soloNombre
  ? OBJETIVOS.filter((o) => o.nombre === soloNombre)
  : OBJETIVOS;

for (const obj of aMigrar) {
  log(`--- ${obj.nombre}`);
  if (!fs.existsSync(obj.raizLocal)) { log(`  carpeta local no encontrada, se salta`); continue; }

  // Lo ya copiado, por id de Drive.
  const ya = new Set();
  for (let desde = 0; ; desde += 1000) {
    const { data } = await admin.from("documentos").select("drive_file_id")
      .eq("empresa_id", obj.empresaId).not("drive_file_id", "is", null).range(desde, desde + 999);
    const t = data ?? [];
    for (const r of t) ya.add(r.drive_file_id);
    if (t.length < 1000) break;
  }
  log(`  ya copiados: ${ya.size}`);

  const todos = listar(obj.raizLocal);
  const pendientes = [];
  for (const p of todos) {
    const id = idDrive(p);
    if (!id || ya.has(id)) continue;
    pendientes.push({ p, id });
  }
  // De menor a mayor: los archivos pequeños entran enseguida y el porcentaje
  // avanza de verdad; los vídeos de varios GB, que son los que atascan una
  // tanda entera, se dejan para el final.
  pendientes.sort((a, b) => {
    try { return fs.statSync(a.p).size - fs.statSync(b.p).size; } catch { return 0; }
  });
  log(`  por subir: ${pendientes.length} de ${todos.length}`);

  let hechos = 0, fallos = 0;
  const reintentar = [];
  for (let i = 0; i < pendientes.length; i += PARALELO) {
    const tanda = pendientes.slice(i, i + PARALELO);
    await Promise.all(tanda.map(async ({ p, id }) => {
      try {
        const rel = path.dirname(path.relative(obj.raizLocal, p));
        const carpetaId = await carpetaPara(obj, rel === "." ? "" : rel);
        const nombre = path.basename(p);
        const ext = path.extname(nombre).toLowerCase();
        const mime = MIMES[ext] ?? "application/octet-stream";
        const tam = fs.statSync(p).size;
        const archivoId = crypto.randomUUID();
        const key = `empresa_${obj.empresaId}/archivos/MARKETING/${archivoId}${ext || ".bin"}`;
        await new Upload({
          client: s3,
          params: { Bucket: BUCKET, Key: key, Body: fs.createReadStream(p), ContentType: mime },
          partSize: 32 * 1024 * 1024, queueSize: 8,
        }).done();
        const { error } = await admin.from("documentos").insert({
          empresa_id: obj.empresaId, carpeta_id: carpetaId, departamento: obj.departamento,
          nombre, r2_key: key, tipo_mime: mime, tamano_bytes: tam,
          subido_por: USER, created_by: USER, drive_file_id: id,
        });
        if (error && error.code !== "23505") throw error;
        hechos++;
      } catch (e) {
        // Un corte de red puntual no es un archivo malo: se reintenta una vez.
        if (/fetch failed|ECONNRESET|socket hang up|timeout/i.test(e.message ?? "")) {
          reintentar.push({ p, id });
        } else {
          fallos++;
          log(`  ERROR ${path.basename(p)}: ${e.message?.slice(0, 120)}`);
        }
      }
    }));
    if (i % (PARALELO * 5) === 0 || i + PARALELO >= pendientes.length) {
      log(`  ${hechos}/${pendientes.length} subidos (${fallos} fallos)`);
    }
  }
  // Segunda pasada para los que se cayeron por red, ya sin prisa (de 3 en 3).
  if (reintentar.length) {
    log(`  reintentando ${reintentar.length} que fallaron por red...`);
    for (let i = 0; i < reintentar.length; i += 3) {
      await Promise.all(reintentar.slice(i, i + 3).map(async ({ p, id }) => {
        try {
          const rel = path.dirname(path.relative(obj.raizLocal, p));
          const carpetaId = await carpetaPara(obj, rel === "." ? "" : rel);
          const nombre = path.basename(p);
          const ext = path.extname(nombre).toLowerCase();
          const mime = MIMES[ext] ?? "application/octet-stream";
          const tam = fs.statSync(p).size;
          const key = `empresa_${obj.empresaId}/archivos/MARKETING/${crypto.randomUUID()}${ext || ".bin"}`;
          await new Upload({
            client: s3,
            params: { Bucket: BUCKET, Key: key, Body: fs.createReadStream(p), ContentType: mime },
            partSize: 16 * 1024 * 1024, queueSize: 4,
          }).done();
          const { error } = await admin.from("documentos").insert({
            empresa_id: obj.empresaId, carpeta_id: carpetaId, departamento: obj.departamento,
            nombre, r2_key: key, tipo_mime: mime, tamano_bytes: tam,
            subido_por: USER, created_by: USER, drive_file_id: id,
          });
          if (error && error.code !== "23505") throw error;
          hechos++;
        } catch (e) {
          fallos++;
          log(`  ERROR (2a) ${path.basename(p)}: ${e.message?.slice(0, 100)}`);
        }
      }));
    }
  }
  log(`  ${obj.nombre} listo: ${hechos} subidos, ${fallos} fallos`);
}
log("=== FIN");
