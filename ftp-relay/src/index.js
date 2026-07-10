/**
 * Balles FTP Relay — buzón FTP → Cloudflare R2 para grabadores Dahua XVR.
 *
 * Por qué existe: los XVR Dahua (gama Lite, ej. DH-XVR4116HS-I) solo saben
 * empujar grabaciones por FTP, en formato propietario .DAV, no MP4 por HTTP.
 * Nuestro software (en Vercel) no puede escuchar FTP ni correr ffmpeg 24/7.
 * Este servicio —UNO solo para todos los clientes, ~5-10 €/mes— cierra el hueco:
 *
 *   XVR ──FTP .dav──▶ [este relay] ──convierte a mp4──▶ POST /api/conector/segmento ──▶ R2
 *
 * El relay NO habla con R2 directamente: reusa el endpoint del software, que ya
 * valida device_token, empresa, cuota y aplica la retención de 30 días. Así toda
 * la lógica de negocio vive en un solo sitio.
 *
 * Autenticación FTP: cada grabador usa como usuario FTP el `pairing_code` o un
 * usuario dedicado por empresa; la contraseña es el device_token del conector.
 * Ese mismo device_token viaja luego como Bearer al endpoint del software.
 */

import { FtpSrv } from "ftp-srv";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Config por entorno ──────────────────────────────────────────────────────
const FTP_PORT = Number(process.env.FTP_PORT ?? 21);
// URL pública anunciada a los clientes FTP en modo pasivo (IP del servidor).
const FTP_PASV_URL = process.env.FTP_PASV_URL ?? "127.0.0.1";
const PASV_MIN = Number(process.env.FTP_PASV_MIN ?? 30000);
const PASV_MAX = Number(process.env.FTP_PASV_MAX ?? 30009);
// Endpoint del software que recibe el clip ya en MP4 y lo sube a R2.
const SEGMENTO_URL = process.env.SEGMENTO_URL; // ej: https://sistema.balleshosteleros.com/api/conector/segmento
// Endpoint del software que resuelve (device_sn|conector, canal) → camara_id.
const RESOLVER_URL = process.env.RESOLVER_URL; // ej: https://sistema.balleshosteleros.com/api/conector/resolver-camara

if (!SEGMENTO_URL || !RESOLVER_URL) {
  console.error("[relay] Faltan SEGMENTO_URL y/o RESOLVER_URL");
  process.exit(1);
}

/**
 * Extrae metadatos de la ruta FTP que usa Dahua. El XVR crea rutas del estilo:
 *   /<SN>/<YYYY-MM-DD>/<canal>/dav/<HH.MM.SS-HH.MM.SS>[...].dav
 * Somos tolerantes: buscamos la fecha, el número de canal y el rango horario.
 */
function parseDahuaPath(ftpPath) {
  const fecha = ftpPath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  // canal: segmento que es solo dígitos y suele ir antes de "/dav"
  const canal = Number(ftpPath.match(/\/(\d{1,2})\/dav\//i)?.[1] ?? NaN);
  // rango horario HH.MM.SS-HH.MM.SS en el nombre de archivo
  const horas = ftpPath.match(/(\d{2})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/);
  return { fecha, canal: Number.isFinite(canal) ? canal : null, horas };
}

/** Construye ISO inicio/fin a partir de fecha + rango horario del nombre. */
function ventanaTemporal({ fecha, horas }) {
  if (!fecha || !horas) {
    const now = new Date().toISOString();
    return { inicio: now, fin: now };
  }
  const [, h1, m1, s1, h2, m2, s2] = horas;
  const inicio = `${fecha}T${h1}:${m1}:${s1}Z`;
  let fin = `${fecha}T${h2}:${m2}:${s2}Z`;
  // Si el fin es menor que el inicio, el clip cruza medianoche: +1 día.
  if (new Date(fin).getTime() < new Date(inicio).getTime()) {
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    fin = `${d.toISOString().slice(0, 10)}T${h2}:${m2}:${s2}Z`;
  }
  return { inicio, fin };
}

/** Convierte un buffer .DAV a MP4 con ffmpeg (remux, sin recodificar si se puede). */
function davToMp4(davPath, mp4Path) {
  return new Promise((resolve, reject) => {
    // -c copy remuxea (rápido, sin pérdida). Si el códec no es compatible con
    // el contenedor mp4, ffmpeg fallará y se puede reintentar recodificando.
    const ff = spawn("ffmpeg", ["-y", "-i", davPath, "-c", "copy", "-movflags", "+faststart", mp4Path]);
    let err = "";
    ff.stderr.on("data", (d) => { err += d.toString(); });
    ff.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg salió con código ${code}: ${err.slice(-500)}`));
    });
    ff.on("error", reject);
  });
}

/** Resuelve el camara_id llamando al software (device_token + canal). */
async function resolverCamara(deviceToken, canal) {
  const res = await fetch(RESOLVER_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${deviceToken}` },
    body: JSON.stringify({ canal }),
  });
  if (!res.ok) throw new Error(`resolver-camara ${res.status}`);
  const data = await res.json();
  if (!data?.camara_id) throw new Error("canal sin cámara asignada");
  return data.camara_id;
}

/** Sube el MP4 al software, que lo guarda en R2. */
async function enviarSegmento(deviceToken, { mp4Buffer, camaraId, inicio, fin }) {
  const form = new FormData();
  form.append("file", new Blob([mp4Buffer], { type: "video/mp4" }), "clip.mp4");
  form.append("camara_id", camaraId);
  form.append("inicio", inicio);
  form.append("fin", fin);
  const res = await fetch(SEGMENTO_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${deviceToken}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`segmento ${res.status}: ${t.slice(0, 200)}`);
  }
}

// ── Servidor FTP ────────────────────────────────────────────────────────────
const server = new FtpSrv({
  url: `ftp://0.0.0.0:${FTP_PORT}`,
  anonymous: false,
  pasv_url: FTP_PASV_URL,
  pasv_min: PASV_MIN,
  pasv_max: PASV_MAX,
});

// El device_token del grabador es su contraseña FTP; lo guardamos por conexión.
server.on("login", ({ username, password, connection }, resolve, reject) => {
  if (!password) return reject(new Error("Credenciales requeridas"));
  connection.deviceToken = password;
  connection.ftpUser = username;
  // Root virtual en memoria: interceptamos las escrituras, no tocamos disco real
  // salvo un temporal por archivo durante la conversión.
  resolve({ root: "/" });
});

server.on("client-error", ({ error }) => {
  console.warn("[relay] client-error:", error?.message ?? error);
});

// Cuando el grabador termina de escribir un .dav, lo procesamos.
server.on("STOR", async (error, filePath, { connection } = {}) => {
  // ftp-srv emite STOR tras el almacenamiento; con FileSystem por defecto el
  // archivo queda en disco. Aquí asumimos el FileSystem por defecto y leemos
  // el archivo recién escrito para convertirlo y reenviarlo.
  if (error) {
    console.warn("[relay] STOR error:", error.message);
    return;
  }
  const deviceToken = connection?.deviceToken;
  if (!deviceToken) return;
  if (!/\.dav$/i.test(filePath)) return; // solo procesamos vídeo .dav

  let work;
  try {
    const meta = parseDahuaPath(filePath);
    if (!meta.canal) throw new Error(`canal no detectado en ${filePath}`);
    const { inicio, fin } = ventanaTemporal(meta);

    work = await mkdtemp(join(tmpdir(), "davrelay-"));
    const davPath = join(work, "in.dav");
    const mp4Path = join(work, "out.mp4");
    // El archivo ya está en disco (FileSystem por defecto de ftp-srv). Lo copiamos
    // al temporal por ruta absoluta del root virtual.
    const raw = await readFile(filePath).catch(() => null);
    if (!raw) throw new Error("no se pudo leer el .dav almacenado");
    await writeFile(davPath, raw);

    await davToMp4(davPath, mp4Path);
    const mp4Buffer = await readFile(mp4Path);

    const camaraId = await resolverCamara(deviceToken, meta.canal);
    await enviarSegmento(deviceToken, { mp4Buffer, camaraId, inicio, fin });
    console.log(`[relay] OK canal ${meta.canal} ${inicio} (${mp4Buffer.length} B)`);
  } catch (e) {
    console.error("[relay] fallo procesando", filePath, "->", e.message);
  } finally {
    if (work) await rm(work, { recursive: true, force: true }).catch(() => {});
    // Limpiamos el .dav original para no acumular disco en el relay.
    await rm(filePath, { force: true }).catch(() => {});
  }
});

server.listen().then(() => {
  console.log(`[relay] FTP escuchando en :${FTP_PORT}, PASV ${FTP_PASV_URL}:${PASV_MIN}-${PASV_MAX}`);
  console.log(`[relay] Reenvía a ${SEGMENTO_URL}`);
});
