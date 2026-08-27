"use client";

/**
 * Render de alta fidelidad de un bloque, usado tanto en preview interno
 * como en rutas públicas (Fase 8).
 *
 * NOTA: texto_libre usa dangerouslySetInnerHTML; el HTML se sanitiza server-side
 * en la action antes de persistir (Fase 7).
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Bloque } from "../../types";
import { imagenOptimizada, srcSetOptimizado } from "../../services/imagen-optimizada";
import type { PaginaContexto } from "./PaginaPublicaShell";
import { Loader2, AtSign, ThumbsUp, MessageCircle, Music2 } from "lucide-react";

export function BloquePublico({
  bloque,
  contexto,
}: {
  bloque: Bloque;
  contexto?: PaginaContexto;
}) {
  if (!bloque.visible) return null;

  switch (bloque.tipo) {
    case "hero":
      return <HeroPublico bloque={bloque} />;
    case "galeria":
      return <GaleriaPublica bloque={bloque} />;
    case "menu":
      return <MenuPublico bloque={bloque} />;
    case "reservas":
      return <ReservasPublico bloque={bloque} contexto={contexto} />;
    case "testimonios":
      return <TestimoniosPublico bloque={bloque} />;
    case "cta":
      return <CtaPublico bloque={bloque} />;
    case "formulario":
      return <FormularioPublico bloque={bloque} contexto={contexto} />;
    case "mapa":
      return <MapaPublico bloque={bloque} />;
    case "footer":
      return <FooterPublico bloque={bloque} />;
    case "texto_libre":
      return <TextoLibrePublico bloque={bloque} />;
    case "video":
      return <VideoPublico bloque={bloque} />;
    case "bolsa_inspectores":
      return <BolsaInspectoresPublico bloque={bloque} contexto={contexto} />;
    case "redes":
      return <RedesPublico bloque={bloque} contexto={contexto} />;
    case "collage_carta":
      return <CollageCartaPublico bloque={bloque} contexto={contexto} />;
    case "premios":
      return <PremiosPublico bloque={bloque} />;
    case "historia":
      return <HistoriaPublica bloque={bloque} />;
    case "instagram":
      return <InstagramPublico bloque={bloque} />;
  }
}

/**
 * Redes sociales. Los enlaces NO viven en el bloque: se leen de la empresa
 * (Ajustes → datos generales), así que actualizar Instagram allí cambia la web
 * sin tocar el editor. Si la empresa no tiene ninguna red, el bloque no se
 * pinta en vez de dejar un hueco vacío.
 */
function RedesPublico({
  bloque,
  contexto,
}: {
  bloque: Extract<Bloque, { tipo: "redes" }>;
  contexto?: PaginaContexto;
}) {
  const { titulo, descripcion } = bloque.datos;
  const redes = contexto?.redes ?? null;

  const items = [
    { clave: "instagram", label: "Instagram", url: redes?.instagram ?? null, Icon: AtSign },
    { clave: "facebook", label: "Facebook", url: redes?.facebook ?? null, Icon: ThumbsUp },
    { clave: "tiktok", label: "TikTok", url: redes?.tiktok ?? null, Icon: Music2 },
    { clave: "whatsapp", label: "WhatsApp", url: redes?.whatsapp ?? null, Icon: MessageCircle },
  ].filter((r) => Boolean(r.url));

  if (!items.length) return null;

  return (
    <section className="py-20 md:py-28 px-4 text-center" id="redes">
      <h2 className="pw-h2 font-extrabold">{titulo}</h2>
      {descripcion ? (
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{descripcion}</p>
      ) : null}
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {items.map(({ clave, label, url, Icon }) => (
          <a
            key={clave}
            href={url as string}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-full border px-6 py-3 font-semibold transition-transform hover:scale-105"
            style={{ borderColor: "var(--pw-primario)", color: "var(--pw-primario)" }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}

/**
 * Mosaico de fotos a sangre con la llamada a la carta encima.
 *
 * La carta NO se incrusta (124-133 platos): el collage vende con imagen y el
 * botón lleva a /carta/[slug], que ya está pensada para leerse en el móvil.
 * Si el bloque no trae fotos propias usa las de la galería de la página, así
 * no hay que volver a subirlas.
 */
/**
 * Iframe que crece hasta el alto de su contenido, para que el formulario de
 * reservas NO tenga scroll propio.
 *
 * POR QUÉ: con alto fijo (760px) el visitante se encontraba una caja con barra
 * de desplazamiento dentro de la página — dos scrolls anidados, que en móvil es
 * especialmente incómodo. Al ser mismo origen podemos medir el documento de
 * dentro y ajustar el alto, así el formulario se ve entero de una vez.
 */
/**
 * Reconocimientos externos. Medallas en el color de marca con el nombre del
 * premio y los años, más un enlace a la ficha pública para que se pueda
 * comprobar: un premio que no se puede verificar resta credibilidad en vez de
 * sumarla.
 */
/**
 * Nuestra historia: foto a un lado, relato al otro, con el año de apertura en
 * grande y la valoración de Google como prueba social. Antes era un
 * `texto_libre`: un párrafo suelto, sin imagen ni jerarquía, que se leía como
 * un pie de página perdido a mitad de web.
 */
/**
 * Tarjeta de Instagram al estilo del propio perfil: avatar con aro de color,
 * arroba, tick de verificado y contador de seguidores. Un CTA de texto plano
 * ("Síguenos en Instagram") no transmite la comunidad que hay detrás.
 */
function InstagramPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "instagram" }> }) {
  const { usuario, titulo, frase, seguidores, publicaciones, verificado, avatar_url, cta_label } =
    bloque.datos;
  const href = `https://www.instagram.com/${usuario.replace(/^@/, "")}`;

  return (
    <section className="px-4 py-20 md:py-28 text-center" id="instagram">
      <h2 className="pw-h2 font-extrabold">{titulo}</h2>
      {frase ? <p className="mx-auto mt-4 max-w-2xl opacity-75">{frase}</p> : null}

      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="mx-auto mt-10 flex max-w-md flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-9 transition-colors hover:bg-white/[0.07]"
      >
        {/* Aro degradado de Instagram alrededor del avatar. */}
        <span
          className="flex h-[86px] w-[86px] items-center justify-center rounded-full p-[3px]"
          style={{ background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}
        >
          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black">
            {avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatar_url} alt={usuario} className="h-full w-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-9 w-9 text-white/80">
                <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.43.42.7.82.92 1.4.17.4.37 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2-.22.6-.5 1-.92 1.4-.42.43-.82.7-1.4.92-.4.17-1 .37-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42-.6-.22-1-.5-1.4-.92-.43-.42-.7-.82-.92-1.4-.17-.4-.37-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.6.5-1 .92-1.4.42-.43.82-.7 1.4-.92.4-.17 1-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2zm0 5.4a4.4 4.4 0 100 8.8 4.4 4.4 0 000-8.8zm0 7.25a2.85 2.85 0 110-5.7 2.85 2.85 0 010 5.7zm5.6-7.42a1.03 1.03 0 11-2.05 0 1.03 1.03 0 012.05 0z" />
              </svg>
            )}
          </span>
        </span>

        <span className="flex items-center justify-center gap-1.5">
          <span className="text-lg font-bold">@{usuario.replace(/^@/, "")}</span>
          {verificado ? (
            /* Tick azul de cuenta verificada, dibujado (no es una imagen de Meta). */
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-label="Cuenta verificada">
              <path
                fill="#3897F0"
                d="M12 1.8l2.4 1.9 3-.3 1.1 2.8 2.7 1.4-.6 3 1.7 2.5-2 2.3.2 3-3 .8-1.6 2.6-2.9-1-2.9 1-1.6-2.6-3-.8.2-3-2-2.3L4.4 8.6 3.8 5.6l2.7-1.4L7.6 1.4l3 .3z"
              />
              <path fill="#fff" d="M10.6 15.2l-2.9-2.9 1.3-1.3 1.6 1.6 4-4 1.3 1.3z" />
            </svg>
          ) : null}
        </span>

        {seguidores || publicaciones ? (
          <span className="flex items-center gap-8">
            {publicaciones ? (
              <span className="text-center">
                <span className="block text-xl font-extrabold">{publicaciones}</span>
                <span className="block text-[11px] uppercase tracking-wider opacity-55">Publicaciones</span>
              </span>
            ) : null}
            {seguidores ? (
              <span className="text-center">
                <span className="block text-xl font-extrabold" style={{ color: "var(--pw-primario)" }}>
                  {seguidores}
                </span>
                <span className="block text-[11px] uppercase tracking-wider opacity-55">Seguidores</span>
              </span>
            ) : null}
          </span>
        ) : null}

        <span
          className="mt-2 inline-block rounded-full px-8 py-3 text-xs font-bold uppercase tracking-wider text-black"
          style={{ backgroundColor: "var(--pw-primario)" }}
        >
          {cta_label}
        </span>
      </a>
    </section>
  );
}

function HistoriaPublica({ bloque }: { bloque: Extract<Bloque, { tipo: "historia" }> }) {
  const { desde, titulo, parrafos, imagen_url, rating, rating_total, rating_href } = bloque.datos;

  return (
    <section className="px-4 py-20 md:py-28" id="historia">
      <div
        className={`mx-auto grid max-w-6xl items-center gap-14 md:gap-16 ${
          imagen_url ? "md:grid-cols-2" : "max-w-3xl"
        }`}
      >
        {imagen_url ? (
          <div className="relative mb-6 md:mb-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenOptimizada(imagen_url, { width: 900, quality: 74 })}
              srcSet={srcSetOptimizado(imagen_url, [600, 900, 1200])}
              sizes="(max-width: 768px) 92vw, 45vw"
              alt={titulo}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full rounded-2xl object-cover"
              onError={(e) => {
                e.currentTarget.src = imagen_url;
              }}
            />
            {/* Año de apertura montado sobre la foto: ancla la historia de un vistazo. */}
            <div
              className="absolute bottom-4 left-4 rounded-xl px-6 py-3 text-center shadow-xl"
              style={{ backgroundColor: "var(--pw-primario)" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/70">Desde</p>
              <p className="text-2xl font-extrabold leading-none text-black">{desde}</p>
            </div>
          </div>
        ) : null}

        <div className="text-left">
          <span className="mb-6 block h-px w-14" style={{ backgroundColor: "var(--pw-primario)" }} />
          <h2 className="pw-h2 font-extrabold leading-tight">{titulo}</h2>
          <div className="mt-6 space-y-4">
            {parrafos.map((t, i) => (
              <p key={i} className="text-[15px] leading-relaxed opacity-80 md:text-base">
                {t}
              </p>
            ))}
          </div>

          {rating ? (
            <a
              href={rating_href ?? "#"}
              {...(rating_href ? { target: "_blank", rel: "noreferrer noopener" } : {})}
              className="mt-9 inline-flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 transition-colors hover:bg-white/[0.07]"
            >
              <span className="text-3xl font-extrabold leading-none" style={{ color: "var(--pw-primario)" }}>
                {rating}
              </span>
              <span className="text-left">
                <span className="block text-sm" style={{ color: "var(--pw-primario)" }}>
                  {"★".repeat(5)}
                </span>
                <span className="block text-xs opacity-60">{rating_total}</span>
              </span>
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PremiosPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "premios" }> }) {
  const { titulo, frase, href, items } = bloque.datos;
  if (!items.length) return null;

  return (
    <section className="py-20 md:py-28 px-4 text-center" id="premios">
      <h2 className="pw-h2 font-extrabold">{titulo}</h2>
      {frase ? (
        <p className="mx-auto mt-4 max-w-2xl text-base md:text-lg opacity-75 leading-relaxed">
          {frase}
        </p>
      ) : null}

      <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-stretch justify-center gap-6">
        {items.map((p, i) => (
          <div key={i} className="flex w-[150px] flex-col items-center gap-2 md:w-[200px]">
            {p.imagen_url ? (
              /* La insignia oficial YA lleva dentro "Recomendado", el año y
                 "Restaurant Guru": repetirlo debajo era ruido. Se deja solo la
                 imagen, a buen tamaño, con el año como apoyo accesible. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={p.imagen_url}
                alt={`${p.nombre} ${p.anios} · ${p.fuente ?? ""}`.trim()}
                loading="lazy"
                decoding="async"
                className="h-[130px] w-[130px] md:h-[170px] md:w-[170px]"
              />
            ) : (
              <>
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl md:h-20 md:w-20"
                  style={{ borderColor: "var(--pw-primario)", color: "var(--pw-primario)" }}
                >
                  ★
                </div>
                <p className="text-[13px] font-bold leading-snug md:text-sm">{p.nombre}</p>
                <p className="text-xs font-semibold tracking-wider" style={{ color: "var(--pw-primario)" }}>
                  {p.anios}
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-10 inline-block text-sm font-semibold underline-offset-4 hover:underline"
          style={{ color: "var(--pw-primario)" }}
        >
          Ver nuestra ficha completa
        </a>
      ) : null}
    </section>
  );
}

function IframeAutoAlto({ src, titulo }: { src: string; titulo: string }) {
  const [alto, setAlto] = useState(720);
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const medir = () => {
      const doc = ref.current?.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(doc.body.scrollHeight, doc.documentElement?.scrollHeight ?? 0);
      if (h > 100) setAlto(h);
    };
    medir();
    // El contenido cambia de alto al elegir día o número de personas.
    const id = window.setInterval(medir, 600);
    window.addEventListener("resize", medir);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", medir);
    };
  }, []);

  return (
    <iframe
      ref={ref}
      src={src}
      title={titulo}
      // Sin fondo blanco ni bordes: el formulario tiene que leerse como parte
      // de la web, no como un recuadro pegado encima.
      className="w-full overflow-hidden border-0 bg-transparent"
      style={{ height: `${alto}px` }}
      scrolling="no"
      loading="lazy"
      onLoad={() => {
        const doc = ref.current?.contentDocument;
        if (doc?.body) setAlto(Math.max(doc.body.scrollHeight, 480));
      }}
    />
  );
}

function CollageCartaPublico({
  bloque,
  contexto,
}: {
  bloque: Extract<Bloque, { tipo: "collage_carta" }>;
  contexto?: PaginaContexto;
}) {
  const { titulo, frase, cta_label, imagenes } = bloque.datos;
  const slug = contexto?.empresaSlug ?? null;
  const fotos = (imagenes ?? []).slice(0, 6);
  if (!fotos.length || !slug) return null;

  return (
    <section className="relative isolate overflow-hidden" id="carta">
      {/* Mosaico: en móvil 2 columnas, en escritorio 3. Las fotos van a sangre
          y en blanco y negro suave, para que el texto de encima se lea siempre
          sin depender de lo clara que sea cada foto. */}
      <div className="grid h-[420px] grid-cols-2 grid-rows-2 md:h-[460px] md:grid-cols-3">
        {fotos.map((img, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={i}
            src={imagenOptimizada(img.url, { width: 700, quality: 72 })}
            srcSet={srcSetOptimizado(img.url, [400, 700, 1000])}
            sizes="(max-width: 768px) 50vw, 33vw"
            alt={img.alt}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover ${i > 3 ? "hidden md:block" : ""}`}
          />
        ))}
      </div>

      {/* Velo oscuro + contenido centrado encima del mosaico. */}
      <div className="absolute inset-0 bg-black/65" />
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <h2 className="pw-h2 font-extrabold text-white drop-shadow-lg">{titulo}</h2>
        {frase ? (
          <p className="mt-4 max-w-2xl text-sm md:text-lg text-white/85 drop-shadow">
            {frase}
          </p>
        ) : null}
        <a
          href={`/carta/${slug}`}
          className="mt-7 inline-block rounded-full px-9 py-4 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105"
          style={{ backgroundColor: "var(--pw-primario)" }}
        >
          {cta_label}
        </a>
      </div>
    </section>
  );
}

function BolsaInspectoresPublico({
  bloque,
  contexto,
}: {
  bloque: Extract<Bloque, { tipo: "bolsa_inspectores" }>;
  contexto?: PaginaContexto;
}) {
  const { titulo, descripcion, cta_label } = bloque.datos;
  const slug = contexto?.empresaSlug ?? null;
  const href = slug ? `/inspectores/bolsa/${slug}` : null;
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-slate-900 to-slate-700 text-white text-center">
      <div className="max-w-2xl mx-auto space-y-4">
        <h2 className="pw-h2 font-extrabold">{titulo}</h2>
        {descripcion && (
          <p className="text-lg text-white/80">{descripcion}</p>
        )}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-4 px-7 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
          >
            {cta_label}
          </a>
        ) : (
          <p className="text-xs text-white/60 mt-4">
            (Configura el slug de la empresa para activar el enlace)
          </p>
        )}
      </div>
    </section>
  );
}

function HeroPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "hero" }> }) {
  const { titulo, subtitulo, cta, foto_url, overlay, video_url } = bloque.datos;
  const poster = foto_url ? imagenOptimizada(foto_url, { width: 1600, quality: 72 }) : undefined;

  return (
    <section className="relative w-full min-h-[92vh] md:min-h-screen flex items-center justify-center overflow-hidden text-center text-white">
      {/* Fondo: vídeo si lo hay (como en GHL), si no la foto. El vídeo entra en
          bucle, mudo y sin controles: es ambiente, no un reproductor. */}
      {video_url ? (
        <video
          src={video_url}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          // Desenfoque y oscurecido suaves: el vídeo es AMBIENTE, no una tele
          // encendida. `scale-105` evita el borde claro que deja el blur.
          className="absolute inset-0 h-full w-full scale-105 object-cover"
          style={{ filter: "blur(3px) brightness(0.62) saturate(0.92)" }}
        />
      ) : poster ? (
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #111, #333)" }} />
      )}

      {/* Doble velo: uno plano que garantiza contraste y un degradado que funde
          la parte baja con el fondo de la web. Un velo uniforme dejaba un corte
          duro entre la foto y la sección siguiente. */}
      <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay ?? 0.5})` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black" />

      <div className="relative z-10 mx-auto max-w-4xl px-6">
        {subtitulo ? (
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.42em] text-white/75 md:text-xs">
            {subtitulo}
          </p>
        ) : null}
        {/* Filete corto sobre el titular: detalle de marca que ordena el bloque. */}
        <span
          className="mx-auto mb-7 block h-px w-16 md:w-20"
          style={{ backgroundColor: "var(--pw-primario)" }}
        />
        <h1 className="pw-h1 font-extrabold leading-[1.08] drop-shadow-[0_2px_18px_rgba(0,0,0,0.55)]">
          {titulo}
        </h1>
        {cta ? (
          <a
            href={cta.href}
            className="mt-11 inline-block rounded-full px-10 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black transition-transform hover:scale-105 md:text-sm"
            style={{ backgroundColor: "var(--pw-primario)" }}
          >
            {cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function GaleriaPublica({ bloque }: { bloque: Extract<Bloque, { tipo: "galeria" }> }) {
  const { imagenes, layout } = bloque.datos;
  if (!imagenes.length) return null;
  if (layout === "carrusel") {
    return (
      <section className="py-14 md:py-20 overflow-x-auto">
        <div className="flex gap-3 px-4 min-w-max">
          {imagenes.map((img, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={i}
              src={imagenOptimizada(img.url, { width: 600 })}
              srcSet={srcSetOptimizado(img.url, [400, 600, 900])}
              sizes="(max-width: 768px) 60vw, 320px"
              alt={img.alt}
              loading="lazy"
              decoding="async"
              className="h-64 w-auto rounded-md object-cover"
            />
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="py-14 md:py-20 px-4 max-w-6xl mx-auto">
      <div className={`grid gap-3 ${layout === "masonry" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
        {imagenes.map((img, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={i}
            src={imagenOptimizada(img.url, { width: 600 })}
            srcSet={srcSetOptimizado(img.url, [400, 600, 900])}
            sizes="(max-width: 768px) 50vw, 300px"
            alt={img.alt}
            // Las 4 primeras entran en pantalla; el resto solo al bajar.
            loading={i < 4 ? "eager" : "lazy"}
            decoding="async"
            className="aspect-square w-full rounded-lg object-cover transition-transform duration-500 hover:scale-[1.03]"
          />
        ))}
      </div>
    </section>
  );
}

interface CartaItemRow {
  id: string;
  categoria_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  orden: number;
  visible: boolean;
}
interface CartaCategoriaRow {
  id: string;
  nombre: string;
  orden: number;
}

function MenuPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "menu" }> }) {
  const datos = bloque.datos;
  const [items, setItems] = useState<CartaItemRow[]>([]);
  const [categorias, setCategorias] = useState<CartaCategoriaRow[]>([]);
  const [cargando, setCargando] = useState(datos.fuente === "carta_items");

  useEffect(() => {
    if (datos.fuente !== "carta_items") return;
    let cancel = false;
    (async () => {
      try {
        const supabase = createClient();
        const [catsRes, itemsRes] = await Promise.all([
          supabase
            .from("carta_categorias")
            .select("id, nombre, orden")
            .eq("visible", true)
            .order("orden", { ascending: true }),
          supabase
            .from("carta_items")
            .select("id, categoria_id, nombre, descripcion, precio, orden, visible")
            .eq("visible", true)
            .order("orden", { ascending: true }),
        ]);
        if (cancel) return;
        setCategorias((catsRes.data ?? []) as CartaCategoriaRow[]);
        setItems(
          ((itemsRes.data ?? []) as Array<Omit<CartaItemRow, "precio"> & { precio: number | string }>).map(
            (r) => ({ ...r, precio: typeof r.precio === "string" ? parseFloat(r.precio) : r.precio }),
          ),
        );
      } catch (err) {
        console.error("[pagina-web][MenuPublico]", err);
      } finally {
        if (!cancel) setCargando(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [datos.fuente]);

  if (datos.fuente === "manual") {
    if (!datos.items_manual?.length) {
      return (
        <section className="py-20 md:py-28 px-4 max-w-4xl mx-auto text-center" id="menu">
          <h2 className="pw-h2 font-extrabold mb-2">Carta</h2>
          <p className="text-sm text-muted-foreground">Sin platos manuales añadidos.</p>
        </section>
      );
    }
    return (
      <section className="py-20 md:py-28 px-4 max-w-4xl mx-auto" id="menu">
        <h2 className="pw-h2 font-extrabold text-center mb-8">Carta</h2>
        <ul className="divide-y">
          {datos.items_manual.map((p, i) => (
            <li key={i} className="py-3 flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">{p.nombre}</div>
                {p.descripcion ? (
                  <div className="text-sm text-muted-foreground">{p.descripcion}</div>
                ) : null}
              </div>
              <div className="font-semibold whitespace-nowrap">
                {p.precio.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  // Fuente: carta_items
  const catsFiltradas =
    datos.categoria_ids && datos.categoria_ids.length
      ? categorias.filter((c) => datos.categoria_ids!.includes(c.id))
      : categorias;

  return (
    <section className="py-20 md:py-28 px-4 max-w-4xl mx-auto" id="menu">
      <h2 className="pw-h2 font-extrabold text-center mb-8">Carta</h2>
      {cargando ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : catsFiltradas.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Publica tu carta digital para que aparezca aquí.
        </p>
      ) : (
        catsFiltradas.map((cat) => {
          const platos = items.filter((i) => i.categoria_id === cat.id);
          if (!platos.length) return null;
          return (
            <div key={cat.id} className="mb-8">
              <h3 className="text-xl font-semibold mb-3">{cat.nombre}</h3>
              <ul className="divide-y">
                {platos.map((p) => (
                  <li key={p.id} className="py-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold">{p.nombre}</div>
                      {p.descripcion ? (
                        <div className="text-sm text-muted-foreground">{p.descripcion}</div>
                      ) : null}
                    </div>
                    <div className="font-semibold whitespace-nowrap">
                      {p.precio.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}

function ReservasPublico({
  bloque,
  contexto,
}: {
  bloque: Extract<Bloque, { tipo: "reservas" }>;
  contexto?: PaginaContexto;
}) {
  const { modo, url } = bloque.datos;
  const slug = contexto?.empresaSlug ?? null;
  return (
    <section className="py-20 md:py-28 px-4 max-w-5xl mx-auto text-center" id="reservas">
      <h2 className="pw-h2 font-extrabold">{bloque.datos.titulo ?? "Reservas"}</h2>
      {bloque.datos.subtitulo ? (
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          {bloque.datos.subtitulo}
        </p>
      ) : null}
      <div className="mb-4" />
      {modo === "portal_propio" ? (
        slug ? (
          // Motor propio: mismo origen, así que no hace falta postMessage para
          // el alto — le damos sitio suficiente y el iframe scrollea solo.
          <IframeAutoAlto src={`/reservar/${slug}/embed`} titulo="Reservar mesa" />
        ) : (
          <p className="text-sm text-muted-foreground">
            (Configura el slug de la empresa para activar las reservas)
          </p>
        )
      ) : modo === "enlace_externo" && url ? (
        <a
          href={url}
          className="inline-block rounded-md bg-black text-white px-6 py-3 font-semibold"
          target="_blank"
          rel="noopener noreferrer"
        >
          Reservar ahora
        </a>
      ) : modo === "embed_cover" && url ? (
        <ReservasEmbed url={url} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Formulario de reserva (Fase 7 conecta con captura de leads).
        </p>
      )}
    </section>
  );
}

/**
 * Motor de reservas externo (CoverManager y equivalentes).
 *
 * Dos detalles que el iframe genérico no cubría:
 *  - allow="payment": el módulo cobra señal/depósito en algunos restaurantes.
 *  - altura: el módulo es vertical y variable (calendario → horas → datos),
 *    no encaja en aspect-video. El proveedor publica su alto real por postMessage
 *    y aquí se aplica; si nunca llega, se queda en el alto inicial de 550px.
 */
const RESERVAS_ORIGENES_PERMITIDOS = ["https://www.covermanager.com"];

function ReservasEmbed({ url }: { url: string }) {
  const [altura, setAltura] = useState(550);

  const origenPermitido = RESERVAS_ORIGENES_PERMITIDOS.some((o) => url.startsWith(`${o}/`));

  useEffect(() => {
    if (!origenPermitido) return;
    function onMensaje(e: MessageEvent) {
      if (!RESERVAS_ORIGENES_PERMITIDOS.includes(e.origin)) return;
      const alto = leerAltura(e.data);
      if (alto && alto > 200 && alto < 5000) setAltura(alto);
    }
    window.addEventListener("message", onMensaje);
    return () => window.removeEventListener("message", onMensaje);
  }, [origenPermitido]);

  if (!origenPermitido) {
    console.warn("[pagina-web][reservas] origen no permitido:", url);
    return (
      <p className="text-sm text-muted-foreground">
        El motor de reservas configurado no está autorizado.
      </p>
    );
  }

  return (
    <iframe
      src={url}
      title="Reservas"
      className="w-full border-0 rounded-md"
      style={{ height: `${altura}px` }}
      allow="payment"
      loading="lazy"
    />
  );
}

/** CoverManager (iframe-resizer) envía "[iFrameSizer]…:<alto>:<ancho>"; otros mandan objeto. */
function leerAltura(data: unknown): number | null {
  if (typeof data === "number") return data;
  if (typeof data === "string") {
    const m = data.match(/(?:height[":\s]+)?(\d{3,4})(?::\d+)?$/);
    return m ? Number(m[1]) : null;
  }
  if (data && typeof data === "object" && "height" in data) {
    const h = Number((data as { height: unknown }).height);
    return Number.isFinite(h) ? h : null;
  }
  return null;
}

function TestimoniosPublico({
  bloque,
}: {
  bloque: Extract<Bloque, { tipo: "testimonios" }>;
}) {
  if (!bloque.datos.items.length) return null;
  const { titulo, subtitulo } = bloque.datos;
  return (
    <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
      <h2 className="pw-h2 font-extrabold text-center">
        {titulo ?? "Lo que dicen nuestros clientes"}
      </h2>
      {subtitulo ? (
        <p className="mt-3 mb-8 text-center text-muted-foreground max-w-2xl mx-auto">
          {subtitulo}
        </p>
      ) : (
        <div className="mb-8" />
      )}
      <div className="grid gap-6 md:grid-cols-3">
        {bloque.datos.items.map((t, i) => (
          <blockquote
            key={i}
            /* Tarjeta sobria sobre fondo oscuro, como en GHL: borde tenue en
               blanco y no el `border`/`bg-muted` del tema claro, que sobre negro
               se veía como una caja gris flotando. */
            className="rounded-xl border border-white/10 bg-white/[0.04] p-7 text-left"
          >
            {t.estrellas ? (
              <div className="mb-3 text-lg" style={{ color: "var(--pw-primario)" }}>
                {"★".repeat(t.estrellas)}
              </div>
            ) : null}
            <p className="text-[15px] leading-relaxed opacity-85">{t.texto}</p>
            <footer className="mt-5 text-sm font-bold uppercase tracking-wider" style={{ color: "var(--pw-primario)" }}>
              {t.nombre}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function CtaPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "cta" }> }) {
  const { titulo, texto, boton } = bloque.datos;

  // Los colores salen del tema de la empresa (--pw-primario). Antes eran negro
  // fijo sobre `bg-muted/30`: en una web de fondo oscuro, el botón secundario
  // quedaba con borde y texto negro sobre negro, es decir, invisible.
  const externo = /^https?:\/\//i.test(boton.href);

  return (
    <section className="py-20 md:py-28 px-4 text-center">
      <h2 className="pw-h2 font-extrabold">{titulo}</h2>
      {texto ? (
        <p className="mt-5 max-w-2xl mx-auto text-base md:text-lg opacity-75 leading-relaxed">
          {texto}
        </p>
      ) : null}
      <a
        href={boton.href}
        {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        /* GHL: pastilla redonda, versalitas y tracking; no un rectángulo. */
        className="mt-9 inline-block rounded-full px-9 py-4 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-105"
        style={
          boton.variante === "primary"
            ? { backgroundColor: "var(--pw-primario)", color: "#000" }
            : {
                border: "1px solid var(--pw-primario)",
                color: "var(--pw-primario)",
              }
        }
      >
        {boton.label}
      </a>
    </section>
  );
}

function FormularioPublico({
  bloque,
  contexto,
}: {
  bloque: Extract<Bloque, { tipo: "formulario" }>;
  contexto?: PaginaContexto;
}) {
  const { titulo, campos, mensaje_exito } = bloque.datos;
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!contexto?.empresaId) {
      setErrorMsg("Formulario no disponible en modo vista previa.");
      return;
    }
    setEnviando(true);
    setErrorMsg(null);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") payload[k] = v;
    }
    try {
      const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      const utm = search
        ? {
            source: search.get("utm_source") ?? undefined,
            medium: search.get("utm_medium") ?? undefined,
            campaign: search.get("utm_campaign") ?? undefined,
          }
        : undefined;
      const res = await fetch("/api/pagina-web/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresaId: contexto.empresaId,
          paginaId: contexto.paginaId,
          bloqueId: bloque.id,
          payload,
          utm: utm && (utm.source || utm.medium || utm.campaign) ? utm : null,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "Error al enviar");
      } else {
        setEnviado(true);
      }
    } catch {
      setErrorMsg("Error de red. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="py-12 px-4 max-w-xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">{titulo}</h2>
      {enviado ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          {mensaje_exito}
        </div>
      ) : (
        <form className="space-y-3" onSubmit={onSubmit}>
          {campos.map((c) => (
            <div key={c.name}>
              <label className="block text-sm mb-1">
                {c.label}
                {c.required ? " *" : ""}
              </label>
              {c.tipo === "textarea" ? (
                <textarea
                  name={c.name}
                  className="w-full rounded border px-3 py-2 text-sm"
                  rows={3}
                  required={c.required}
                  disabled={enviando}
                />
              ) : (
                <input
                  type={c.tipo}
                  name={c.name}
                  className="w-full rounded border px-3 py-2 text-sm"
                  required={c.required}
                  disabled={enviando}
                />
              )}
            </div>
          ))}
          {/* Consentimiento obligatorio: el formulario recoge nombre, correo y
              teléfono. Sin casilla marcada por el usuario y sin enlace a la
              política, la recogida no cumple el RGPD (arts. 6.1.a y 13).
              La casilla NO puede venir premarcada: el consentimiento tiene que
              ser un acto afirmativo. */}
          <label className="flex items-start gap-2 pt-1 text-xs leading-snug opacity-80">
            <input
              type="checkbox"
              name="consentimiento_privacidad"
              required
              disabled={enviando}
              className="mt-0.5 shrink-0"
            />
            <span>
              He leído y acepto la{" "}
              <a
                href="/politica-de-privacidad"
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2"
              >
                política de privacidad
              </a>
              .
            </span>
          </label>

          {errorMsg ? (
            <p className="text-sm text-red-600">{errorMsg}</p>
          ) : null}
          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-black text-white px-5 py-2 font-semibold text-sm disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </form>
      )}
    </section>
  );
}

function MapaPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "mapa" }> }) {
  const { lat, lng, zoom, direccion_texto } = bloque.datos;
  const [mapaActivo, setMapaActivo] = useState(false);
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}&zoom=${zoom}`;
  // `id="mapa"`: el pie enlaza la dirección con href="#mapa". Sin este ancla el
  // enlace no hacía nada al pulsarlo.
  // El enlace "Cómo llegar" abre la app de mapas del móvil, que es lo que de
  // verdad quiere quien está buscando el sitio desde la calle.
  const comoLlegar = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    direccion_texto || `${lat},${lng}`,
  )}`;

  return (
    <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto scroll-mt-24" id="mapa">
      <h2 className="pw-h2 font-extrabold text-center mb-4">Cómo llegar</h2>
      <p className="text-center text-muted-foreground mb-3">{direccion_texto}</p>
      <p className="text-center mb-6">
        <a
          href={comoLlegar}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sm font-semibold underline underline-offset-2"
          style={{ color: "var(--pw-primario)" }}
        >
          Abrir en Google Maps
        </a>
      </p>
      {/* Fondo claro bajo el iframe: si el mapa tarda o falla, se ve un hueco
          gris en vez de un agujero negro sobre el fondo oscuro de la web. */}
      {/* El mapa NO captura la rueda del ratón: al bajar por la web con el
          cursor encima, en vez de seguir bajando hacía zoom. El velo invisible
          se lleva el scroll; al pulsar sobre el mapa se desactiva y ya se puede
          arrastrar y hacer zoom con normalidad. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/10 bg-neutral-200">
        <iframe
          src={src}
          className="h-full w-full"
          title="Mapa"
          loading="lazy"
          style={{ pointerEvents: mapaActivo ? "auto" : "none" }}
        />
        {!mapaActivo ? (
          <button
            type="button"
            onClick={() => setMapaActivo(true)}
            aria-label="Activar el mapa"
            className="absolute inset-0 flex items-end justify-center bg-transparent pb-4"
          >
            <span className="rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm">
              Pulsa para mover el mapa
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function FooterPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "footer" }> }) {
  const { columnas, redes, texto_legal } = bloque.datos;
  return (
    /* `id="contacto"`: la barra superior enlaza aquí (href="#contacto"), donde
       viven teléfono, correo y horarios. */
    <footer className="bg-black text-white py-16 px-4 scroll-mt-24" id="contacto">
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-3">
        {columnas.map((c, i) => (
          <div key={i}>
            <h4 className="mb-1 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: "var(--pw-primario)" }}>
              {c.titulo}
            </h4>
            <span className="mb-4 block h-px w-10" style={{ backgroundColor: "var(--pw-primario)", opacity: 0.5 }} />
            <ul className="space-y-2 text-sm opacity-75">
              {c.items.map((it, j) => {
                // Los horarios se guardan como items con href="#" porque no
                // llevan a ninguna parte. Pintados como enlace, al pulsarlos
                // saltaban al principio de la página; van como texto.
                const esTexto = !it.href || it.href === "#";
                return (
                  <li key={j}>
                    {esTexto ? (
                      <span>{it.label}</span>
                    ) : (
                      <a href={it.href} className="hover:underline">
                        {it.label}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      {redes && redes.length ? (
        <div className="max-w-6xl mx-auto mt-6 flex gap-3 justify-center">
          {redes.map((r, i) => (
            <a key={i} href={r.url} className="text-sm underline opacity-80 hover:opacity-100">
              {r.red}
            </a>
          ))}
        </div>
      ) : null}
      {texto_legal ? (
        <p className="max-w-6xl mx-auto mt-6 text-center text-xs opacity-60">{texto_legal}</p>
      ) : null}
    </footer>
  );
}

function TextoLibrePublico({
  bloque,
}: {
  bloque: Extract<Bloque, { tipo: "texto_libre" }>;
}) {
  // Estilos propios en vez de `prose`: el plugin @tailwindcss/typography no
  // está instalado en el proyecto, así que esas clases no pintaban nada y el
  // HTML salía sin jerarquía (títulos y párrafos iguales).
  // `pt-28` deja sitio a la nav fija, que si no tapa el primer titular en las
  // páginas que empiezan por texto — las legales, sin hero.
  return (
    <section className="pw-texto mx-auto max-w-3xl px-4 pb-10 pt-28">
      <div dangerouslySetInnerHTML={{ __html: bloque.datos.html_seguro }} />
      <style>{`
        .pw-texto { color: rgba(245,245,244,.82); line-height: 1.7; }
        .pw-texto h1 { font-size: clamp(1.9rem, 4vw, 2.6rem); font-weight: 700; color: var(--pw-primario); margin: 0 0 1.2rem; line-height: 1.15; }
        .pw-texto h2 { font-size: 1.3rem; font-weight: 600; color: #fff; margin: 2.2rem 0 .7rem; }
        .pw-texto h3 { font-size: 1.05rem; font-weight: 600; color: #fff; margin: 1.6rem 0 .5rem; }
        .pw-texto p { margin: 0 0 1rem; }
        .pw-texto ul, .pw-texto ol { margin: 0 0 1.2rem; padding-left: 1.3rem; }
        .pw-texto li { margin-bottom: .4rem; }
        .pw-texto ul { list-style: disc; }
        .pw-texto ol { list-style: decimal; }
        .pw-texto strong { color: #fff; font-weight: 600; }
        .pw-texto a { color: var(--pw-primario); text-decoration: underline; text-underline-offset: 2px; }
        .pw-texto table { width: 100%; border-collapse: collapse; margin: 0 0 1.5rem; font-size: .9rem; display: block; overflow-x: auto; }
        .pw-texto th, .pw-texto td { border: 1px solid rgba(255,255,255,.14); padding: .55rem .7rem; text-align: left; vertical-align: top; }
        .pw-texto th { background: rgba(255,255,255,.06); color: #fff; font-weight: 600; }
      `}</style>
    </section>
  );
}

function VideoPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "video" }> }) {
  const { proveedor, url, autoplay, muted } = bloque.datos;
  const src =
    proveedor === "youtube"
      ? toYouTubeEmbed(url, autoplay, muted)
      : proveedor === "vimeo"
        ? toVimeoEmbed(url, autoplay, muted)
        : null;
  return (
    <section className="py-10 px-4 max-w-5xl mx-auto">
      <div className="aspect-video w-full rounded-md overflow-hidden bg-black">
        {src ? (
          <iframe
            src={src}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            title="Video"
          />
        ) : (
          <video
            src={url}
            // Con autoplay es fondo cinematográfico (como en GHL): sin controles
            // ni barra de progreso. Sin autoplay sí los lleva, para poder darle.
            controls={!autoplay}
            autoPlay={autoplay}
            muted={muted}
            loop={autoplay}
            playsInline
            // `metadata` (y no "auto") para que el navegador no se baje los ~2,5 MB
            // del vídeo antes de que al visitante le dé tiempo a verlo: con
            // autoplay se descarga igual, pero deja de bloquear la primera pintura.
            preload={autoplay ? "auto" : "metadata"}
            poster={posterDeVideo(url)}
            className="w-full h-full object-cover"
          />
        )}
      </div>
    </section>
  );
}

/**
 * Los vídeos migrados traen su fotograma como `<nombre>-poster.jpg` en el mismo
 * bucket. Sirve de cartel mientras carga: sin él la portada arranca en negro.
 */
function posterDeVideo(url: string): string | undefined {
  if (!url.includes("/storage/v1/object/public/")) return undefined;
  const m = url.match(/^(.*)\.(mp4|webm|mov)(\?.*)?$/i);
  if (!m) return undefined;
  return imagenOptimizada(`${m[1]}-poster.jpg`, { width: 1200, quality: 70 });
}

function toYouTubeEmbed(url: string, autoplay: boolean, muted: boolean): string {
  const m =
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ||
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ||
    url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
  const id = m?.[1] ?? "";
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "1");
  if (muted) params.set("mute", "1");
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

function toVimeoEmbed(url: string, autoplay: boolean, muted: boolean): string {
  const m = url.match(/vimeo\.com\/(\d+)/);
  const id = m?.[1] ?? "";
  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "1");
  if (muted) params.set("muted", "1");
  return `https://player.vimeo.com/video/${id}?${params.toString()}`;
}
