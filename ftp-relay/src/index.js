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
import { mkdirSync } from "node:fs";
import { mkdir as mkdirAsync, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// El FileSystem por defecto de ftp-srv no crea carpetas al hacer CWD/STOR: el
// XVR Dahua sube a rutas del tipo /<IP-del-grabador>/<fecha>/archivo.dav sin
// avisar con MKD antes, así que sin este parche todo falla con ENOENT.
const require = createRequire(import.meta.url);
const BaseFileSystem = require("ftp-srv/src/fs.js");
class AutoMkdirFileSystem extends BaseFileSystem {
  async chdir(path = ".") {
    const { fsPath } = this._resolvePath(path);
    await mkdirAsync(fsPath, { recursive: true }).catch(() => {});
    return super.chdir(path);
  }

  write(fileName, opts = {}) {
    const { fsPath } = this._resolvePath(fileName);
    mkdirSync(dirname(fsPath), { recursive: true });
    return super.write(fileName, opts);
  }
}

// ── Config por entorno ──────────────────────────────────────────────────────
const FTP_PORT = Number(process.env.FTP_PORT ?? 21);
// URL pública anunciada a los clientes FTP en modo pasivo (IP del servidor).
const FTP_PASV_URL = process.env.FTP_PASV_URL ?? "127.0.0.1";
const PASV_MIN = Number(process.env.FTP_PASV_MIN ?? 30000);
const PASV_MAX = Number(process.env.FTP_PASV_MAX ?? 30009);
// Carpeta donde aterrizan los .dav mientras se procesan; aislada del resto
// del contenedor.
const FTP_ROOT = process.env.FTP_ROOT ?? "/data/ftp";
mkdirSync(FTP_ROOT, { recursive: true });
// Endpoint del software que recibe el clip ya en MP4 y lo sube a R2.
const SEGMENTO_URL = process.env.SEGMENTO_URL; // ej: https://sistema.balleshosteleros.com/api/conector/segmento
// Endpoint del software que resuelve (device_sn|conector, canal) → camara_id.
const RESOLVER_URL = process.env.RESOLVER_URL; // ej: https://sistema.balleshosteleros.com/api/conector/resolver-camara

if (!SEGMENTO_URL || !RESOLVER_URL) {
  console.error("[relay] Faltan SEGMENTO_URL y/o RESOLVER_URL");
  process.exit(1);
}

/** YYYYMMDDHHMMSS → ISO 8601 UTC. */
function digitsToIso(ts) {
  const y = ts.slice(0, 4), mo = ts.slice(4, 6), d = ts.slice(6, 8);
  const h = ts.slice(8, 10), mi = ts.slice(10, 12), s = ts.slice(12, 14);
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

/**
 * Extrae canal + ventana temporal de la ruta/archivo FTP que sube el XVR.
 *
 * Formato real observado (Dahua XVR4116HS-I, confirmado en producción):
 *   /<IP-grabador>/<YYYY-MM-DD>/<Empresa>_ch<N>_main_<inicio14>_<fin14>.dav
 * donde inicio14/fin14 son YYYYMMDDHHMMSS. Se mantiene como respaldo el
 * esquema documentado por Dahua para otros modelos
 * (/<SN>/<fecha>/<canal>/dav/<HH.MM.SS-HH.MM.SS>...), por si algún grabador
 * lo usa en su lugar.
 */
function parseDahuaPath(ftpPath) {
  const real = ftpPath.match(/_ch(\d{1,2})_main_(\d{14})_(\d{14})\.dav$/i);
  if (real) {
    const [, canal, inicio14, fin14] = real;
    return { canal: Number(canal), inicio: digitsToIso(inicio14), fin: digitsToIso(fin14) };
  }

  const fecha = ftpPath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
  const canalAlt = Number(ftpPath.match(/\/(\d{1,2})\/dav\//i)?.[1] ?? NaN);
  const horas = ftpPath.match(/(\d{2})\.(\d{2})\.(\d{2})-(\d{2})\.(\d{2})\.(\d{2})/);
  if (!fecha || !horas || !Number.isFinite(canalAlt)) {
    const now = new Date().toISOString();
    return { canal: Number.isFinite(canalAlt) ? canalAlt : null, inicio: now, fin: now };
  }
  const [, h1, m1, s1, h2, m2, s2] = horas;
  const inicio = `${fecha}T${h1}:${m1}:${s1}Z`;
  let fin = `${fecha}T${h2}:${m2}:${s2}Z`;
  if (new Date(fin).getTime() < new Date(inicio).getTime()) {
    const d = new Date(`${fecha}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    fin = `${d.toISOString().slice(0, 10)}T${h2}:${m2}:${s2}Z`;
  }
  return { canal: canalAlt, inicio, fin };
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

// Algunos XVR Dahua (gama Lite) limitan el campo de contraseña FTP a pocos
// caracteres y no aceptan el device_token completo (64 hex). FTP_CREDENTIALS
// mapea una contraseña corta, la que el instalador teclea en el grabador, al
// device_token real que el software espera como Bearer. Formato:
//   {"bacanal":{"password":"XXXX","deviceToken":"..."}, "habana":{...}}
let ftpCredentials = {};
try {
  ftpCredentials = JSON.parse(process.env.FTP_CREDENTIALS ?? "{}");
} catch (e) {
  console.error("[relay] FTP_CREDENTIALS inválido:", e.message);
}

server.on("login", ({ username, password, connection }, resolve, reject) => {
  if (!password) return reject(new Error("Credenciales requeridas"));
  const cred = ftpCredentials[(username ?? "").trim().toLowerCase()];
  // Si el usuario tiene alias corto configurado, exige que coincida y traduce
  // al device_token real; si no, se mantiene el modo anterior (password =
  // device_token directo), para no romper conectores sin alias.
  if (cred) {
    if (password !== cred.password) return reject(new Error("Credenciales inválidas"));
    connection.deviceToken = cred.deviceToken;
  } else {
    connection.deviceToken = password;
  }
  connection.ftpUser = username;
  // Carpeta propia (no todo el contenedor) con creación automática de
  // subcarpetas: el XVR sube a /<ip-grabador>/<fecha>/archivo.dav sin MKD
  // previo. Los .dav se borran tras procesarlos (ver STOR); las carpetas
  // vacías se quedan, pero pesan nada.
  resolve({ fs: new AutoMkdirFileSystem(connection, { root: FTP_ROOT, cwd: "/" }) });
});

server.on("client-error", ({ error }) => {
  console.warn("[relay] client-error:", error?.message ?? error);
});

// ftp-srv emite 'STOR' en la CONEXIÓN (this.emit dentro del handler del
// comando, ligado a la instancia de FtpConnection), no en el servidor —
// server.on("STOR", ...) nunca se dispara. Hay que engancharlo por conexión,
// enterándonos de cada una nueva por el evento 'connect' del servidor.
server.on("connect", ({ connection }) => {
  connection.on("STOR", async (error, filePath) => {
    if (error) {
      console.warn("[relay] STOR error:", error.message);
      return;
    }
    const deviceToken = connection.deviceToken;
    if (!deviceToken) return;
    if (!/\.dav$/i.test(filePath)) return; // solo procesamos vídeo .dav

    let work;
    try {
      const meta = parseDahuaPath(filePath);
      if (!meta.canal) throw new Error(`canal no detectado en ${filePath}`);

      work = await mkdtemp(join(tmpdir(), "davrelay-"));
      const davPath = join(work, "in.dav");
      const mp4Path = join(work, "out.mp4");
      // filePath es la ruta real en disco (stream.path), no la virtual del
      // cliente — ver AutoMkdirFileSystem/root más arriba.
      const raw = await readFile(filePath).catch(() => null);
      if (!raw) throw new Error("no se pudo leer el .dav almacenado");
      await writeFile(davPath, raw);

      await davToMp4(davPath, mp4Path);
      const mp4Buffer = await readFile(mp4Path);

      const camaraId = await resolverCamara(deviceToken, meta.canal);
      await enviarSegmento(deviceToken, { mp4Buffer, camaraId, inicio: meta.inicio, fin: meta.fin });
      console.log(`[relay] OK canal ${meta.canal} ${meta.inicio} (${mp4Buffer.length} B)`);
    } catch (e) {
      console.error("[relay] fallo procesando", filePath, "->", e.message);
    } finally {
      if (work) await rm(work, { recursive: true, force: true }).catch(() => {});
      // Limpiamos el .dav original para no acumular disco en el relay.
      await rm(filePath, { force: true }).catch(() => {});
    }
  });
});

server.listen().then(() => {
  console.log(`[relay] FTP escuchando en :${FTP_PORT}, PASV ${FTP_PASV_URL}:${PASV_MIN}-${PASV_MAX}`);
  console.log(`[relay] Reenvía a ${SEGMENTO_URL}`);
});
