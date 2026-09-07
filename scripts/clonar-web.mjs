/**
 * PRP-088 — Clona una web externa IDÉNTICA dando solo su dirección, sube sus
 * archivos a R2 y la guarda como página del software.
 *
 * Es el proceso inverso al importador de GoHighLevel. A diferencia del viejo
 * `importador-html.ts`, aquí no se adivina nada: se abre la web en un navegador
 * de verdad, se guarda el diseño ya pintado y todos los archivos que usa.
 *
 * Uso:
 *   node scripts/clonar-web.mjs --empresa <uuid> [--embudo "Evergreen 1"] <url> [url…]
 *   node scripts/clonar-web.mjs --empresa <uuid> --solo-local <url>   (no toca R2 ni BD)
 *
 * Requiere Chromium de Playwright y ffmpeg (para los vídeos en HLS).
 * Solo sobre webs propias o encargadas por su dueño.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { bloqueDeReconexion } from "./lib/reconexion-replica.mjs";

// --- .env.local a mano: el script corre fuera de Next ---
for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const EXT_POR_TIPO = {
  "text/css": "css",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "application/font-woff2": "woff2",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
};
const TIPOS_A_GUARDAR = /^(image|font|media|video|audio)\//;
// Los trozos del HLS (video/MP2T) y sus listas los pide el reproductor mientras
// se reproduce, pero el vídeo ya se descarga entero como mp4: guardarlos solo
// engordaba la copia con decenas de MB inútiles.
const TIPOS_BASURA = /^(video\/MP2T|application\/vnd\.apple\.mpegurl|application\/x-mpegURL)$/i;

function nombreDeArchivo(url, contentType) {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const base = (contentType ?? "").split(";")[0].trim();
  let ext = EXT_POR_TIPO[base];
  if (!ext) {
    const m = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    ext = m ? m[1].toLowerCase() : "bin";
  }
  return `${hash}.${ext}`;
}

/**
 * Abre la web, la recorre entera y devuelve el diseño ya pintado más todos sus
 * archivos. `urlDe(nombre)` decide con qué dirección queda cada archivo en la
 * copia (una carpeta local, o R2).
 */
export async function clonar(url, urlDe) {
  const archivos = new Map(); // url original -> { nombre, buffer, tipo }
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  pagina.on("response", async (res) => {
    try {
      if (res.status() !== 200) return;
      const tipo = (res.headers()["content-type"] ?? "").split(";")[0].trim();
      const u = res.url();
      if (u.startsWith("data:") || archivos.has(u)) return;
      if (TIPOS_BASURA.test(tipo) || /\.(m3u8|ts)(\?|$)/i.test(u)) return;
      if (!TIPOS_A_GUARDAR.test(tipo) && tipo !== "text/css") return;
      archivos.set(u, { nombre: nombreDeArchivo(u, tipo), buffer: await res.body(), tipo });
    } catch {
      /* respuesta ya descartada por el navegador */
    }
  });

  // Se prefiere esperar a que la red quede en silencio, porque así se garantiza
  // que han entrado los archivos que la página pide sola. Pero hay webs que no
  // callan nunca —un chat, una analítica que reintenta, un iframe vivo— y ahí
  // esa espera SIEMPRE agota el tiempo y la página no se clona. Las de
  // herramientas de balleshosteleros.com son justo así. En ese caso basta con
  // esperar a que termine de cargar: el recorrido de scroll que viene después
  // dispara igualmente la carga perezosa.
  try {
    await pagina.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
  } catch {
    console.log("  · la red no se queda en silencio; se espera solo a que cargue");
    await pagina.goto(url, { waitUntil: "load", timeout: 90_000 });
    await pagina.waitForTimeout(3_000);
  }

  // Bajar hasta el final: sin esto no se disparan ni la carga perezosa de
  // imágenes ni las animaciones de entrada, y la copia sale a medias.
  await pagina.evaluate(async () => {
    const paso = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += paso) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 800));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 500));
  });
  await pagina.waitForTimeout(1500);

  // Vídeos: GoHighLevel los sirve con video.js + HLS y el src del <video> es un
  // `blob:`, que no se puede copiar (la copia salía en negro). Se le pregunta al
  // propio reproductor por su lista de reproducción.
  const reproductores = await pagina.evaluate(() => {
    const salida = [];
    const vjs = window.videojs;
    if (!vjs?.getAllPlayers) return salida;
    for (const pl of vjs.getAllPlayers()) {
      let hls = null;
      try {
        hls = pl.tech(true)?.vhs?.source_?.src ?? pl.currentSrc?.() ?? null;
      } catch {
        /* reproductor sin iniciar */
      }
      if (hls?.includes(".m3u8")) salida.push({ id: pl.id(), hls });
    }
    return salida;
  });

  const videos = reproductores.map((pl) => {
    const hash = createHash("sha1").update(pl.hls).digest("hex").slice(0, 16);
    return { ...pl, mp4: `video-${hash}.mp4`, poster: `video-${hash}.jpg` };
  });

  const titulo = await pagina.title();

  let html = await pagina.evaluate(
    ({ videos, urls }) => {
      // Sin los scripts del origen no queda nada que ejecutar: el diseño ya está
      // pintado, y así la copia no lanza los píxeles de terceros.
      document.querySelectorAll("script").forEach((s) => s.remove());
      document
        .querySelectorAll(
          'link[rel="preload"], link[rel="prefetch"], link[rel="modulepreload"], ' +
            'link[rel="dns-prefetch"], link[rel="preconnect"], link[rel="manifest"], ' +
            // GoHighLevel deja decenas de <link as="script"> SIN rel: el
            // navegador no los pide, pero dejan el rastro del origen dentro de
            // la copia.
            'link[as="script"], noscript',
        )
        .forEach((el) => el.remove());

      // Toda referencia a absoluta ANTES de serializar. Si no, las rutas
      // relativas (/_next/…) apuntan al servidor que sirva la copia y la web
      // sale SIN ESTILOS.
      const abs = (v) => {
        try {
          return new URL(v, location.href).href;
        } catch {
          return v;
        }
      };
      const absEnCss = (css) =>
        css.replace(/url\((['"]?)([^'")]+)\1\)/g, (o, q, r) =>
          r.startsWith("data:") || r.startsWith("#") ? o : `url("${abs(r)}")`,
        );

      for (const attr of ["src", "href", "poster", "data-src", "data-srcset"]) {
        document.querySelectorAll(`[${attr}]`).forEach((el) => {
          const v = el.getAttribute(attr);
          if (!v || v.startsWith("data:") || v.startsWith("#") || /^(mailto|tel|javascript):/i.test(v)) return;
          el.setAttribute(attr, abs(v));
        });
      }
      document.querySelectorAll("[srcset]").forEach((el) => {
        el.setAttribute(
          "srcset",
          el
            .getAttribute("srcset")
            .split(",")
            .map((c) => {
              const [u, ...d] = c.trim().split(/\s+/);
              return [abs(u), ...d].join(" ");
            })
            .join(", "),
        );
      });
      document.querySelectorAll('[style*="url("]').forEach((el) => {
        el.setAttribute("style", absEnCss(el.getAttribute("style")));
      });
      document.querySelectorAll("style").forEach((el) => {
        el.textContent = absEnCss(el.textContent);
      });

      // El reproductor de GHL es JavaScript puro: sin sus scripts no funciona.
      // Se cambia por un <video> normal con el mp4 descargado. El
      // position:absolute es obligatorio: sin él queda con altura 0 dentro del
      // contenedor de video.js y se sigue viendo negro aunque el vídeo esté bien.
      for (const v of videos) {
        const cont = document.getElementById(v.id);
        if (!cont) continue;
        const el = document.createElement("video");
        el.setAttribute("data-clon-src", urls[v.mp4]);
        el.setAttribute("data-clon-poster", urls[v.poster]);
        el.setAttribute("controls", "");
        el.setAttribute("playsinline", "");
        el.setAttribute("preload", "metadata");
        el.style.cssText =
          "position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;background:#000";
        cont.replaceChildren(el);
      }

      return "<!doctype html>\n" + document.documentElement.outerHTML;
    },
    { videos, urls: Object.fromEntries(videos.flatMap((v) => [[v.mp4, urlDe(v.mp4)], [v.poster, urlDe(v.poster)]])) },
  );

  await navegador.close();

  html = html.replace(/data-clon-src=/g, "src=").replace(/data-clon-poster=/g, "poster=");

  // Segunda pasada: lo que el navegador nunca llegó a pedir (otras
  // resoluciones del srcset, precargas, la imagen de compartir).
  // Se mira el html Y el contenido de las hojas de estilo: las tipografías de
  // un @font-face que la página no llegó a usar no las pide el navegador, y sin
  // esto se quedaban apuntando al CDN del origen (dependencia que no se ve).
  const pendientes = new Set();
  const textoAEscanear =
    html + [...archivos.values()].filter((a) => a.tipo === "text/css").map((a) => a.buffer.toString("utf8")).join("\n");
  for (const m of textoAEscanear.matchAll(/https?:\/\/[^\s"'()<>\\]+/g)) {
    const u = m[0].replace(/&amp;/g, "&");
    if (archivos.has(u)) continue;
    if (/\.(jpg|jpeg|png|webp|avif|gif|svg|ico|mp4|webm|woff2?|ttf|otf|css)(\?|$)/i.test(u)) pendientes.add(u);
  }
  await Promise.all(
    [...pendientes].map(async (u) => {
      try {
        const r = await fetch(u);
        if (!r.ok) return;
        const tipo = (r.headers.get("content-type") ?? "").split(";")[0].trim();
        archivos.set(u, {
          nombre: nombreDeArchivo(u, tipo),
          buffer: Buffer.from(await r.arrayBuffer()),
          tipo,
        });
      } catch {
        /* inalcanzable: se queda la dirección original */
      }
    }),
  );

  // Las hojas de estilo traen sus propias direcciones dentro de url(…).
  //
  // ⚠️ Las TIPOGRAFÍAS se incrustan como datos dentro del css, no se enlazan:
  // una fuente servida desde otro dominio exige cabeceras CORS, y el
  // almacenamiento no las manda — el navegador se negaba a cargarlas y la copia
  // salía con otra letra. Incrustadas, el problema desaparece y la copia queda
  // autosuficiente.
  const esFuente = (tipo, nombre) => /^(font|application\/font)/i.test(tipo ?? "") || /\.(woff2?|ttf|otf|eot)$/i.test(nombre);

  for (const [u, a] of archivos) {
    if (a.tipo !== "text/css") continue;
    const css = a.buffer.toString("utf8").replace(/url\((['"]?)([^'")]+)\1\)/g, (orig, q, ref) => {
      if (ref.startsWith("data:")) return orig;
      let absoluta;
      try {
        absoluta = new URL(ref, u).toString();
      } catch {
        return orig;
      }
      const destino = archivos.get(absoluta);
      if (!destino) return orig;
      if (esFuente(destino.tipo, destino.nombre)) {
        const mime = destino.tipo || "font/woff2";
        return `url("data:${mime};base64,${destino.buffer.toString("base64")}")`;
      }
      return `url("${urlDe(destino.nombre)}")`;
    });
    a.buffer = Buffer.from(css, "utf8");
  }

  for (const [u, a] of archivos) {
    if (a.tipo === "text/css") continue; // el css se incrusta entero más abajo
    if (esFuente(a.tipo, a.nombre)) {
      // Solo los formatos que usa un navegador de hoy. Incrustar además eot,
      // ttf y svg —que el mismo @font-face declara por compatibilidad con
      // navegadores de hace diez años— multiplicaría por cinco el peso de la
      // página para algo que nadie pide.
      if (!/\.(woff2?)$/i.test(a.nombre)) continue;
      const dato = `data:${a.tipo || "font/woff2"};base64,${a.buffer.toString("base64")}`;
      html = html.split(u).join(dato).split(u.replace(/&/g, "&amp;")).join(dato);
      continue;
    }
    const destino = urlDe(a.nombre);
    html = html.split(u).join(destino).split(u.replace(/&/g, "&amp;")).join(destino);
  }

  // Los <link> de estilos se cambian por el css en el sitio exacto donde
  // estaban: el orden de la cascada manda, y moverlos cambiaría el diseño.
  for (const [u, a] of archivos) {
    if (a.tipo !== "text/css") continue;
    const escapada = u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patron = new RegExp(`<link[^>]*href=["']${escapada}(?:&amp;[^"']*)?["'][^>]*>`, "gi");
    let primero = true;
    html = html.replace(patron, () => {
      if (!primero) return "";
      primero = false;
      return `<style>${a.buffer.toString("utf8")}</style>`;
    });
  }

  // Los enlaces al sitio de origen pasan a rutas nuestras: así los pasos del
  // embudo se encadenan entre ellos y no devuelven al cliente a GoHighLevel.
  const origen = new URL(url).origin;
  html = html.split(`"${origen}/`).join('"/').split(`"${origen}"`).join('"/"');

  // Lo que sigue apuntando fuera. Se descuenta nuestro propio destino: si no,
  // las direcciones ya migradas a R2 se contarían como pendientes y el aviso
  // engañaría (pasó en la primera subida real).
  const nuestro = urlDe("");
  const sinTraer = [...new Set([...html.matchAll(/https?:\/\/[^\s"'()<>\\]+/g)].map((m) => m[0]))]
    .filter((u) => /\.(jpg|jpeg|png|webp|avif|gif|svg|mp4|woff2?|css)(\?|$)/i.test(u))
    .filter((u) => !u.startsWith(nuestro));

  return { html, archivos, videos, titulo, sinTraer };
}

/** Descarga los vídeos en HLS con ffmpeg, en la mejor calidad, con su portada. */
export async function descargarVideos(videos, carpeta) {
  mkdirSync(carpeta, { recursive: true });
  const resultado = [];
  for (const v of videos) {
    try {
      const master = await (await fetch(v.hls)).text();
      const lineas = master.split("\n");
      let mejor = { alto: 0, url: null };
      for (let i = 0; i < lineas.length; i++) {
        const res = lineas[i].match(/RESOLUTION=(\d+)x(\d+)/);
        if (res && lineas[i + 1]?.trim()) {
          const alto = parseInt(res[2], 10);
          if (alto > mejor.alto) mejor = { alto, url: new URL(lineas[i + 1].trim(), v.hls).toString() };
        }
      }
      const mp4 = join(carpeta, v.mp4);
      const poster = join(carpeta, v.poster);
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", mejor.url ?? v.hls, "-c", "copy", "-bsf:a", "aac_adtstoasc", mp4]);
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-ss", "1", "-i", mp4, "-frames:v", "1", "-q:v", "3", poster]);
      resultado.push({ nombre: v.mp4, ruta: mp4, tipo: "video/mp4", calidad: `${mejor.alto}p` });
      resultado.push({ nombre: v.poster, ruta: poster, tipo: "image/jpeg" });
    } catch (e) {
      console.log(`  ✗ vídeo ${v.id}: ${e.message.split("\n")[0]}`);
    }
  }
  return resultado;
}

// ─────────────────────────── línea de comandos ───────────────────────────

if (process.argv[1]?.endsWith("clonar-web.mjs")) {
  const args = process.argv.slice(2);
  const leer = (bandera) => {
    const i = args.indexOf(bandera);
    return i >= 0 ? args[i + 1] : null;
  };
  const empresaId = leer("--empresa");
  const nombreEmbudo = leer("--embudo");
  // Qué hacen los botones que se quedaron mudos al quitar los scripts del origen.
  const pasoSiguiente = leer("--paso-siguiente");
  const pedirDatos = args.includes("--pedir-datos");
  const soloLocal = args.includes("--solo-local");
  const urls = args.filter((a) => a.startsWith("http"));

  if (urls.length === 0) {
    console.error("Uso: node scripts/clonar-web.mjs --empresa <uuid> [--embudo \"Nombre\"] [--paso-siguiente /vsl] [--pedir-datos] <url> [url…]");
    process.exit(1);
  }
  if (!soloLocal && !empresaId) {
    console.error("Falta --empresa (o usa --solo-local para no tocar R2 ni la base de datos)");
    process.exit(1);
  }

  const { R2_BUCKET_NAME: BUCKET, R2_PUBLIC_URL: PUBLIC_URL, R2_ENDPOINT: ENDPOINT,
          R2_ACCESS_KEY_ID: KEY, R2_SECRET_ACCESS_KEY: SECRET,
          NEXT_PUBLIC_SUPABASE_URL: SB_URL, SUPABASE_SERVICE_ROLE_KEY: SB_KEY } = process.env;

  const r2 = soloLocal ? null : new S3Client({ region: "auto", endpoint: ENDPOINT, credentials: { accessKeyId: KEY, secretAccessKey: SECRET } });
  const sb = soloLocal ? null : createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

  let embudoId = null;
  if (!soloLocal && nombreEmbudo) {
    const { data, error } = await sb
      .from("paginas_web_embudos")
      .insert({ empresa_id: empresaId, nombre: nombreEmbudo, origen_url: new URL(urls[0]).origin })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo crear el embudo: ${error.message}`);
    embudoId = data.id;
    console.log(`Embudo «${nombreEmbudo}» creado.`);
  }

  for (const [indice, url] of urls.entries()) {
    const slug = (new URL(url).pathname.replace(/^\/+|\/+$/g, "") || "principal").toLowerCase();
    const prefijo = soloLocal ? "" : `empresa_${empresaId}/web/replica/${slug}/`;
    const urlDe = (nombre) => (soloLocal ? `./assets/${nombre}` : `${PUBLIC_URL}/${prefijo}${nombre}`);

    console.log(`\n▸ ${url}`);
    const { html, archivos, videos, titulo, sinTraer } = await clonar(url, urlDe);
    const carpetaVideos = join(tmpdir(), `clon-${slug}`);
    const ficherosVideo = await descargarVideos(videos, carpetaVideos);

    const inventario = [];
    if (soloLocal) {
      const destino = join("clones", slug);
      mkdirSync(join(destino, "assets"), { recursive: true });
      for (const a of archivos.values()) writeFileSync(join(destino, "assets", a.nombre), a.buffer);
      for (const f of ficherosVideo) writeFileSync(join(destino, "assets", f.nombre), readFileSync(f.ruta));
      writeFileSync(join(destino, "index.html"), html, "utf8");
      console.log(`  ✓ guardado en ${destino}`);
    } else {
      for (const a of archivos.values()) {
        // El css y las tipografías ya viajan dentro del documento (CORS).
        if (a.tipo === "text/css" || /^(font|application\/font)/i.test(a.tipo ?? "") || /\.(woff2?|ttf|otf|eot)$/i.test(a.nombre)) continue;
        await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: prefijo + a.nombre, Body: a.buffer, ContentType: a.tipo || "application/octet-stream" }));
        inventario.push({ clave: prefijo + a.nombre, tipo: a.tipo, bytes: a.buffer.length });
      }
      for (const f of ficherosVideo) {
        const buffer = readFileSync(f.ruta);
        await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: prefijo + f.nombre, Body: buffer, ContentType: f.tipo }));
        inventario.push({ clave: prefijo + f.nombre, tipo: f.tipo, bytes: buffer.length });
      }

      // Si la página YA existía, se respeta a qué embudo pertenece y su estado.
      // Sin esto, volver a clonar una página suelta la sacaba de su embudo y la
      // devolvía a BORRADOR: pasó de verdad al rehacer el embudo de Balles.
      const { data: previa } = await sb
        .from("paginas_web")
        .select("tipo, estado, embudo_id, embudo_orden")
        .eq("empresa_id", empresaId)
        .eq("slug_interno", slug)
        .maybeSingle();

      const fila = {
        empresa_id: empresaId,
        tipo: nombreEmbudo ? "EMBUDO_PASO" : previa?.tipo ?? "ONE_PAGE",
        nombre: titulo || slug,
        slug_interno: slug,
        bloques: [],
        estado: previa?.estado ?? "BORRADOR",
        html_replica: html,
        replica_origen_url: url,
        replica_capturada_at: new Date().toISOString(),
        replica_assets: inventario,
        embudo_id: embudoId ?? previa?.embudo_id ?? null,
        embudo_orden: embudoId ? indice : previa?.embudo_orden ?? null,
      };
      const { data: guardada, error } = await sb
        .from("paginas_web")
        .upsert(fila, { onConflict: "empresa_id,slug_interno" })
        .select("id")
        .single();
      if (error) throw new Error(`No se pudo guardar la página: ${error.message}`);

      // Reconexión: los botones del original vuelven a funcionar, pero contra
      // el software. Se hace después de guardar porque necesita el id de la
      // página para etiquetar el lead.
      if (pasoSiguiente || pedirDatos) {
        const bloque = bloqueDeReconexion({
          empresaId,
          paginaId: guardada.id,
          siguiente: pasoSiguiente,
          pedirDatos,
          tituloFormulario: leer("--titulo-formulario") ?? "Déjanos tus datos y sigue",
        });
        const conReconexion = html.includes("</body>")
          ? html.replace("</body>", `${bloque}</body>`)
          : html + bloque;
        const { error: errRec } = await sb
          .from("paginas_web")
          .update({ html_replica: conReconexion })
          .eq("id", guardada.id);
        if (errRec) throw new Error(`No se pudo reconectar la página: ${errRec.message}`);
        console.log(`  ✓ botones reconectados${pedirDatos ? " (piden datos)" : ""}${pasoSiguiente ? ` → ${pasoSiguiente}` : ""}`);
      }
      const mb = inventario.reduce((n, a) => n + a.bytes, 0) / 1024 / 1024;
      console.log(`  ✓ ${slug}: ${inventario.length} archivos · ${mb.toFixed(1)} MB · ${videos.length} vídeo(s)`);
    }
    if (sinTraer.length > 0) console.log(`  ⚠ ${sinTraer.length} direcciones externas sin traer:`, sinTraer.slice(0, 3));
  }

  console.log("\nListo. Las páginas quedan en BORRADOR: publicar es un acto aparte.");
}
