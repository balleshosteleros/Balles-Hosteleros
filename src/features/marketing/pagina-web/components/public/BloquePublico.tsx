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
      return <MapaPublico bloque={bloque} contexto={contexto} />;
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
  const { usuario, titulo, frase, seguidores, publicaciones, verificado, avatar_url, cta_label, feed } =
    bloque.datos;
  const handle = usuario.replace(/^@/, "");
  const href = `https://www.instagram.com/${handle}`;
  const fotos = (feed ?? []).slice(0, 6);

  return (
    <section className="relative overflow-hidden px-4 py-20 md:py-28" id="instagram">
      {/* Resplandor de marca detrás del móvil: da profundidad sin cargar la
          sección con más fotos. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.13] blur-[110px]"
        style={{ backgroundColor: "var(--pw-primario)" }}
      />

      <div className="relative mx-auto max-w-5xl">
        <h2 className="pw-h2 text-center font-extrabold">{titulo}</h2>
        {frase ? <p className="mx-auto mt-4 max-w-2xl text-center opacity-75">{frase}</p> : null}

        <div className="mt-14 flex items-end justify-center gap-0">
          {/* Silueta izquierda: dos personas mirando el móvil. Es una forma
              dibujada, no una foto de stock — encaja con cualquier marca y no
              añade peso ni derechos de imagen. */}
          <SiluetaPersonas lado="izq" />

          {/* Maqueta de iPhone con el perfil abierto */}
          <div className="relative z-10 w-[260px] shrink-0 md:w-[300px]">
            <div className="rounded-[42px] border-[10px] border-neutral-800 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.75)]">
              {/* Muesca superior */}
              <div className="relative flex h-6 items-center justify-center">
                <span className="h-[18px] w-[95px] rounded-b-2xl bg-neutral-800" />
              </div>

              <div className="px-3 pb-4">
                {/* Cabecera del perfil */}
                <div className="flex items-center gap-3 py-3">
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full p-[2.5px]"
                    style={{ background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}
                  >
                    <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black">
                      {avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={avatar_url} alt={handle} className="h-full w-full object-cover" />
                      ) : (
                        <IconoInstagram className="h-6 w-6 text-white/80" />
                      )}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-[13px] font-bold text-white">
                      <span className="truncate">{handle}</span>
                      {verificado ? <TickVerificado /> : null}
                    </p>
                    <div className="mt-1.5 flex gap-4 text-[11px] text-white/70">
                      {publicaciones ? (
                        <span><b className="text-white">{publicaciones}</b> pub.</span>
                      ) : null}
                      {seguidores ? (
                        <span><b className="text-white">{seguidores}</b> seguidores</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Botón Seguir, como en la app */}
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mb-3 block rounded-lg py-2 text-center text-[13px] font-semibold text-black transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--pw-primario)" }}
                >
                  {cta_label}
                </a>

                {/* Cuadrícula del feed */}
                <div className="grid grid-cols-3 gap-[3px]">
                  {fotos.map((f, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={i}
                      src={imagenOptimizada(f.url, { width: 220, quality: 68 })}
                      alt={f.alt}
                      loading="lazy"
                      decoding="async"
                      className="aspect-square w-full object-cover"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <SiluetaPersonas lado="der" />
        </div>

      </div>
    </section>
  );
}

/** Tick azul de cuenta verificada, dibujado (no es el recurso de Meta). */
function TickVerificado() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-label="Cuenta verificada">
      <path fill="#3897F0" d="M12 1.8l2.4 1.9 3-.3 1.1 2.8 2.7 1.4-.6 3 1.7 2.5-2 2.3.2 3-3 .8-1.6 2.6-2.9-1-2.9 1-1.6-2.6-3-.8.2-3-2-2.3L4.4 8.6 3.8 5.6l2.7-1.4L7.6 1.4l3 .3z" />
      <path fill="#fff" d="M10.6 15.2l-2.9-2.9 1.3-1.3 1.6 1.6 4-4 1.3 1.3z" />
    </svg>
  );
}

function IconoInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.43.42.7.82.92 1.4.17.4.37 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2-.22.6-.5 1-.92 1.4-.42.43-.82.7-1.4.92-.4.17-1 .37-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42-.6-.22-1-.5-1.4-.92-.43-.42-.7-.82-.92-1.4-.17-.4-.37-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.6.5-1 .92-1.4.42-.43.82-.7 1.4-.92.4-.17 1-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2zm0 5.4a4.4 4.4 0 100 8.8 4.4 4.4 0 000-8.8zm0 7.25a2.85 2.85 0 110-5.7 2.85 2.85 0 010 5.7zm5.6-7.42a1.03 1.03 0 11-2.05 0 1.03 1.03 0 012.05 0z" />
    </svg>
  );
}

/**
 * Siluetas de personas mirando el móvil, a los lados de la maqueta. Van
 * dibujadas y no en foto: no dependen de un banco de imágenes, pesan nada y
 * funcionan con el color de marca de cualquier empresa. Se ocultan en móvil,
 * donde no hay sitio.
 */
function SiluetaPersonas({ lado }: { lado: "izq" | "der" }) {
  const espejo = lado === "der";
  return (
    <div
      aria-hidden
      className={`hidden h-[300px] w-[190px] shrink-0 md:block ${espejo ? "-ml-8 scale-x-[-1]" : "-mr-8"}`}
    >
      <svg viewBox="0 0 190 300" className="h-full w-full">
        <g fill="currentColor" className="text-white" opacity="0.16">
          {/* Persona del fondo */}
          <circle cx="58" cy="72" r="25" />
          <path d="M18 300c0-46 18-78 40-78s40 32 40 78z" />
          {/* Persona delante, algo más grande */}
          <circle cx="122" cy="92" r="29" />
          <path d="M74 300c0-52 22-86 48-86s48 34 48 86z" />
        </g>
        {/* Reflejo de la pantalla en las caras: el detalle que cuenta que están
            mirando el móvil. */}
        <ellipse cx="80" cy="86" rx="13" ry="9" fill="currentColor" className="text-white" opacity="0.1" />
        <ellipse cx="146" cy="106" rx="15" ry="10" fill="currentColor" className="text-white" opacity="0.1" />
      </svg>
    </div>
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
            <NotaGoogle
              rating={rating}
              rating_total={rating_total}
              rating_href={rating_href}
              className="mt-9"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Nota de Google como prueba social.
 *
 * Lleva la "G" OFICIAL con sus cuatro colores, no la palabra "Google" escrita
 * en el texto: el logo se reconoce de un vistazo y es lo que hace creíble la
 * nota. Mismo trazado que publica Google en su guía de marca, inline como SVG
 * para no depender de un CDN externo.
 */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/** Píldora con la nota media de Google. Se usa en Historia y en Testimonios. */
function NotaGoogle({
  rating,
  rating_total,
  rating_href,
  className,
}: {
  rating: string;
  rating_total?: string;
  rating_href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <GoogleG className="h-7 w-7 shrink-0" />
      <span className="h-9 w-px bg-white/10" aria-hidden />
      <span className="text-3xl font-extrabold leading-none" style={{ color: "var(--pw-primario)" }}>
        {rating}
      </span>
      <span className="text-left">
        <span className="block text-sm leading-none" style={{ color: "var(--pw-primario)" }}>
          {"★".repeat(5)}
        </span>
        {rating_total ? <span className="mt-1 block text-xs opacity-60">{rating_total}</span> : null}
      </span>
    </>
  );
  const cls = `inline-flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 transition-colors hover:bg-white/[0.09] ${className ?? ""}`;
  return rating_href ? (
    <a href={rating_href} target="_blank" rel="noreferrer noopener" className={cls}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
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

      <div className="mx-auto mt-12 flex max-w-5xl flex-wrap items-stretch justify-center gap-8 md:gap-10">
        {items.map((p, i) => (
          <div key={i} className="flex w-[150px] flex-col items-center gap-2 md:w-[200px]">
            {p.imagen_url ? (
              /* La insignia oficial YA lleva dentro "Recomendado", el año y
                 "Restaurant Guru": repetirlo debajo era ruido. Se deja solo la
                 imagen, a buen tamaño, con el año como apoyo accesible.

                 El sello se presenta sobre un disco oscuro con halo dorado y
                 filo de luz: suelto sobre el negro se veía como un recorte
                 pegado, y son cuatro años de reconocimiento — merecen leerse
                 como una medalla, no como un adhesivo. */
              <span
                className="group relative inline-flex h-[150px] w-[150px] items-center justify-center rounded-full transition-transform duration-500 hover:-translate-y-1.5 md:h-[190px] md:w-[190px]"
                style={{
                  background:
                    "radial-gradient(circle at 50% 32%, color-mix(in srgb, var(--pw-primario) 22%, transparent) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.015) 100%)",
                  border: "1px solid color-mix(in srgb, var(--pw-primario) 38%, transparent)",
                  boxShadow:
                    "0 18px 40px -18px color-mix(in srgb, var(--pw-primario) 60%, transparent), inset 0 1px 0 rgba(255,255,255,0.12)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imagen_url}
                  alt={`${p.nombre} ${p.anios} · ${p.fuente ?? ""}`.trim()}
                  loading="lazy"
                  decoding="async"
                  className="h-[118px] w-[118px] drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)] md:h-[150px] md:w-[150px]"
                />
              </span>
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

/** Viñeta en el color de marca para las listas de apoyo. */
function Punto() {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: "var(--pw-primario)" }}
    />
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
  // UNA sola foto, no un mosaico: seis imágenes competían entre sí y la sección
  // se leía cargada. Con una buena foto a sangre el mensaje llega antes.
  const foto = imagenes?.[0];
  if (!foto || !slug) return null;

  return (
    <section className="relative isolate overflow-hidden" id="carta">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imagenOptimizada(foto.url, { width: 1600, quality: 74 })}
        srcSet={srcSetOptimizado(foto.url, [800, 1200, 1600])}
        sizes="100vw"
        alt={foto.alt}
        loading="lazy"
        decoding="async"
        className="h-[440px] w-full object-cover md:h-[560px]"
      />

      {/* Velo plano + degradado: contraste garantizado y unión suave con la
          sección siguiente, sin el corte duro de un velo uniforme. */}
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black" />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span className="mb-7 block h-px w-14" style={{ backgroundColor: "var(--pw-primario)" }} />
        <h2 className="pw-h2 max-w-3xl font-extrabold text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.6)]">
          {titulo}
        </h2>
        {frase ? (
          <p className="mt-5 max-w-xl text-sm text-white/80 md:text-base">{frase}</p>
        ) : null}
        <a
          href={`/carta/${slug}`}
          className="mt-9 inline-block rounded-full px-10 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black transition-transform hover:scale-105 md:text-sm"
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
    <section className="relative overflow-hidden px-4 py-20 md:py-28" id="reservas">
      {/* Resplandor de marca detrás del formulario: separa visualmente la
          sección de las contiguas sin meter otra franja de color. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-[0.10] blur-[130px]"
        style={{ backgroundColor: "var(--pw-primario)" }}
      />

      <div className="relative mx-auto max-w-4xl text-center">
        <span className="mx-auto mb-6 block h-px w-14" style={{ backgroundColor: "var(--pw-primario)" }} />
        <h2 className="pw-h2 font-extrabold">{bloque.datos.titulo ?? "Reservas"}</h2>
        {bloque.datos.subtitulo ? (
          <p className="mx-auto mt-5 max-w-2xl text-base opacity-75 md:text-lg">
            {bloque.datos.subtitulo}
          </p>
        ) : null}

        {/* Tres apoyos antes del formulario: quitan la duda de "¿esto qué me
            pide?" justo donde el visitante decide si sigue o se va. */}
        <ul className="mx-auto mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] opacity-70">
          <li className="flex items-center gap-2">
            <Punto /> Confirmación inmediata
          </li>
          <li className="flex items-center gap-2">
            <Punto /> Sin coste ni comisiones
          </li>
          <li className="flex items-center gap-2">
            <Punto /> Cancela cuando quieras
          </li>
        </ul>

        {modo === "portal_propio" ? (
          slug ? (
            /* Tarjeta con esquinas muy redondeadas y cristal difuminado: el
               formulario deja de ser un recuadro pegado y se integra en la web. */
            <div className="mt-12 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl md:rounded-[34px] md:p-3">
              <div className="overflow-hidden rounded-[22px] bg-white md:rounded-[26px]">
                <IframeAutoAlto src={`/reservar/${slug}/embed`} titulo="Reservar mesa" />
              </div>
            </div>
          ) : (
            <p className="mt-10 text-sm text-muted-foreground">
              (Configura el slug de la empresa para activar las reservas)
            </p>
          )
        ) : modo === "enlace_externo" && url ? (
          <a
            href={url}
            className="mt-10 inline-block rounded-full px-10 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black transition-transform hover:scale-105"
            style={{ backgroundColor: "var(--pw-primario)" }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Reservar ahora
          </a>
        ) : modo === "embed_cover" && url ? (
          <div className="mt-12 overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl md:rounded-[34px] md:p-3">
            <div className="overflow-hidden rounded-[22px] bg-white md:rounded-[26px]">
              <ReservasEmbed url={url} />
            </div>
          </div>
        ) : (
          <p className="mt-10 text-sm text-muted-foreground">
            Reservas no configuradas.
          </p>
        )}
      </div>
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
  const { titulo, subtitulo, rating, rating_total, rating_href } = bloque.datos;
  return (
    <section className="py-20 md:py-28 px-4 max-w-6xl mx-auto">
      <h2 className="pw-h2 font-extrabold text-center">
        {titulo ?? "Lo que dicen nuestros clientes"}
      </h2>

      {/* Nota media de Google sobre los testimonios: da contexto a las opiniones
          sueltas (una reseña buena convence menos que un 4,6 con miles detrás). */}
      {rating ? (
        <div className="mt-7 flex justify-center">
          <NotaGoogle rating={rating} rating_total={rating_total} rating_href={rating_href} />
        </div>
      ) : null}
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
  const { titulo, texto, boton, imagen_url } = bloque.datos;

  // Los colores salen del tema de la empresa (--pw-primario). Antes eran negro
  // fijo sobre `bg-muted/30`: en una web de fondo oscuro, el botón secundario
  // quedaba con borde y texto negro sobre negro, es decir, invisible.
  const externo = /^https?:\/\//i.test(boton.href);

  // Botón SIEMPRE sólido en la variante primaria y con sombra propia: sobre una
  // foto de fondo, un botón de solo borde se pierde entre el ruido de la imagen.
  const botonStyle =
    boton.variante === "primary"
      ? {
          backgroundColor: "var(--pw-primario)",
          color: "#000",
          boxShadow: "0 10px 30px -8px color-mix(in srgb, var(--pw-primario) 65%, transparent)",
        }
      : {
          backgroundColor: "color-mix(in srgb, var(--pw-primario) 14%, transparent)",
          border: "1px solid var(--pw-primario)",
          color: "var(--pw-primario)",
          backdropFilter: "blur(6px)",
        };

  const contenido = (
    <>
      <h2 className="pw-h2 font-extrabold">{titulo}</h2>
      {texto ? (
        <p className="mt-5 max-w-2xl mx-auto text-base md:text-lg opacity-80 leading-relaxed">
          {texto}
        </p>
      ) : null}
      <a
        href={boton.href}
        {...(externo ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        /* GHL: pastilla redonda, versalitas y tracking; no un rectángulo. */
        className="mt-9 inline-block rounded-full px-10 py-4 text-sm font-bold uppercase tracking-wider transition-transform hover:scale-105"
        style={botonStyle}
      >
        {boton.label}
      </a>
    </>
  );

  // Sin foto: la sección de siempre, centrada sobre el fondo de la página.
  if (!imagen_url) {
    return <section className="py-20 md:py-28 px-4 text-center">{contenido}</section>;
  }

  // Con foto: el equipo al fondo, DIFUMINADO y oscurecido. La imagen ambienta,
  // no compite — si se deja nítida, el titular deja de leerse.
  return (
    <section className="relative isolate overflow-hidden px-4 py-24 text-center md:py-32">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 scale-110 bg-cover bg-center"
        style={{ backgroundImage: `url(${imagen_url})`, filter: "blur(7px) saturate(115%)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.62) 45%, rgba(0,0,0,0.86) 100%)",
        }}
      />
      <div className="relative">{contenido}</div>
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

function MapaPublico({
  bloque,
  contexto,
}: {
  bloque: Extract<Bloque, { tipo: "mapa" }>;
  contexto?: PaginaContexto;
}) {
  const { lat, lng, direccion_texto } = bloque.datos;
  const [mapaActivo, setMapaActivo] = useState(false);
  const logo = contexto?.logoUrl ?? null;

  // Tiles en escala de grises (CARTO Positron): el mapa estándar de OSM/Google
  // mete verdes, azules y rótulos que chocan con una web oscura de restaurante.
  // Aquí el mapa es fondo y el único color lo pone el marcador de la casa.
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.004},${lat - 0.003},${lng + 0.004},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`;
  const comoLlegar = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    direccion_texto || `${lat},${lng}`,
  )}`;

  return (
    /* Mapa a un LADO, no a toda página: llegar es un dato práctico, no el
       argumento de venta. Ocupando media pantalla robaba el sitio a la comida.
       A la izquierda la dirección y el botón; a la derecha el mapa, pequeño. */
    <section className="scroll-mt-24 px-4 py-20 md:py-28" id="mapa">
      <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[1fr_1.15fr] md:gap-14">
        <div className="text-center md:text-left">
          <h2 className="pw-h2 font-extrabold">Cómo llegar</h2>
          <p className="mt-4 text-sm opacity-70 md:text-base">{direccion_texto}</p>

          <a
            href={comoLlegar}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-7 inline-block rounded-full px-8 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-black transition-transform hover:scale-105"
            style={{
              backgroundColor: "var(--pw-primario)",
              boxShadow: "0 10px 30px -10px color-mix(in srgb, var(--pw-primario) 70%, transparent)",
            }}
          >
            Cómo llegar
          </a>
        </div>

        <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 md:aspect-[4/3]">
          <iframe
            src={src}
            className="h-full w-full"
            title="Mapa"
            loading="lazy"
            /* Desaturado y oscurecido para que encaje con la web. */
            style={{
              filter: "grayscale(1) invert(0.92) contrast(0.86) brightness(0.95)",
              pointerEvents: mapaActivo ? "auto" : "none",
            }}
          />

          {/* Marcador con el isotipo de la empresa, encima del centro del mapa. */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] bg-black shadow-2xl md:h-16 md:w-16"
              style={{ borderColor: "var(--pw-primario)" }}
            >
              {logo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logo} alt="" className="h-9 w-9 object-contain md:h-11 md:w-11" />
              ) : (
                <span className="text-xl" style={{ color: "var(--pw-primario)" }}>
                  ●
                </span>
              )}
            </div>
            {/* Puntita del pin */}
            <span
              className="mx-auto block h-3 w-[3px]"
              style={{ backgroundColor: "var(--pw-primario)" }}
            />
          </div>

          {!mapaActivo ? (
            <button
              type="button"
              onClick={() => setMapaActivo(true)}
              aria-label="Activar el mapa"
              className="absolute inset-0 flex items-end justify-center bg-transparent pb-4"
            >
              <span className="rounded-full bg-black/70 px-4 py-2 text-[11px] font-semibold text-white backdrop-blur-sm">
                Pulsa para mover el mapa
              </span>
            </button>
          ) : null}
        </div>

        </div>
      </div>
    </section>
  );
}

/**
 * Icono de red social, dibujado inline.
 *
 * Se usan los trazados de marca (Instagram, Facebook, TikTok, WhatsApp) en
 * `currentColor` para que hereden el color del pie y del hover. Inline y no un
 * paquete de iconos: son cuatro y así no se carga una librería entera.
 */
function IconoRed({ red }: { red: string }) {
  const k = red.toLowerCase();
  const cls = "h-[18px] w-[18px]";
  if (k.includes("insta")) {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.98c-3.14 0-3.51.01-4.75.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.4.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.04-.9-.19-1.39-.32-1.71a2.86 2.86 0 0 0-.69-1.06 2.86 2.86 0 0 0-1.06-.69c-.32-.13-.81-.28-1.71-.32-1.24-.06-1.61-.07-4.75-.07Zm0 3.37a4.49 4.49 0 1 1 0 8.98 4.49 4.49 0 0 1 0-8.98Zm0 7.4a2.91 2.91 0 1 0 0-5.82 2.91 2.91 0 0 0 0 5.82Zm5.72-7.58a1.05 1.05 0 1 1-2.1 0 1.05 1.05 0 0 1 2.1 0Z" />
      </svg>
    );
  }
  if (k.includes("face")) {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
        <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
      </svg>
    );
  }
  if (k.includes("tik")) {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
        <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 1 1 .77-5.06V9.7a5.68 5.68 0 1 0 4.91 5.63V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.29 4.29 0 0 1-3.24-1.48Z" />
      </svg>
    );
  }
  if (k.includes("whats")) {
    return (
      <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
        <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.16-1.35a9.92 9.92 0 0 0 4.88 1.25h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.89 9.89 0 0 0 12.04 2Zm0 18.15h-.01a8.26 8.26 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.25 8.25 0 0 1-1.27-4.41c0-4.57 3.72-8.28 8.29-8.28 2.21 0 4.29.86 5.85 2.43a8.22 8.22 0 0 1 2.42 5.86c0 4.57-3.72 8.26-8.29 8.26Zm4.54-6.19c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.84-.2-.49-.4-.42-.56-.43-.14 0-.31-.01-.47-.01a.9.9 0 0 0-.66.31c-.22.24-.87.85-.87 2.08s.89 2.41 1.02 2.58c.12.16 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.68-1.18.2-.58.2-1.08.14-1.18-.06-.11-.22-.17-.47-.29Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="9" />
    </svg>
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
        /* ICONOS de marca, no el nombre de la red subrayado: en un pie, "instagram"
           escrito parece un enlace legal más y se pierde entre "Aviso legal" y
           "Cookies". El icono se reconoce sin leer. */
        <div className="mx-auto mt-10 flex max-w-6xl justify-center gap-3">
          {redes.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={r.red}
              title={r.red}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/75 transition-all hover:-translate-y-0.5 hover:text-black"
              style={{ ["--hov" as string]: "var(--pw-primario)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--pw-primario)";
                e.currentTarget.style.borderColor = "var(--pw-primario)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
              }}
            >
              <IconoRed red={r.red} />
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
