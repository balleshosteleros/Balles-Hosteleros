"use client";

/**
 * Render de alta fidelidad de un bloque, usado tanto en preview interno
 * como en rutas públicas (Fase 8).
 *
 * NOTA: texto_libre usa dangerouslySetInnerHTML; el HTML se sanitiza server-side
 * en la action antes de persistir (Fase 7).
 */
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Bloque } from "../../types";
import type { PaginaContexto } from "./PaginaPublicaShell";
import { Loader2 } from "lucide-react";

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
      return <ReservasPublico bloque={bloque} />;
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
  }
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
        <h2 className="text-3xl md:text-4xl font-bold">{titulo}</h2>
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
  const { titulo, subtitulo, cta, foto_url, overlay } = bloque.datos;
  return (
    <section
      className="relative w-full min-h-[60vh] flex items-center justify-center text-center text-white"
      style={
        foto_url
          ? { backgroundImage: `url(${foto_url})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: "linear-gradient(135deg, #111, #333)" }
      }
    >
      {foto_url ? (
        <div
          className="absolute inset-0"
          style={{ background: `rgba(0,0,0,${overlay ?? 0.4})` }}
        />
      ) : null}
      <div className="relative z-10 px-4 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-bold">{titulo}</h1>
        {subtitulo ? <p className="mt-4 text-lg md:text-xl opacity-90">{subtitulo}</p> : null}
        {cta ? (
          <a
            href={cta.href}
            className="inline-block mt-8 rounded-md bg-white px-6 py-3 text-black font-semibold hover:bg-white/90"
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
      <section className="py-8 overflow-x-auto">
        <div className="flex gap-3 px-4 min-w-max">
          {imagenes.map((img, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={i}
              src={img.url}
              alt={img.alt}
              className="h-64 w-auto rounded-md object-cover"
            />
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="py-8 px-4 max-w-6xl mx-auto">
      <div className={`grid gap-3 ${layout === "masonry" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
        {imagenes.map((img, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={i}
            src={img.url}
            alt={img.alt}
            className={`w-full object-cover rounded-md ${layout === "masonry" ? "h-auto" : "aspect-square"}`}
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
        <section className="py-12 px-4 max-w-4xl mx-auto text-center" id="menu">
          <h2 className="text-3xl font-bold mb-2">Carta</h2>
          <p className="text-sm text-muted-foreground">Sin platos manuales añadidos.</p>
        </section>
      );
    }
    return (
      <section className="py-12 px-4 max-w-4xl mx-auto" id="menu">
        <h2 className="text-3xl font-bold text-center mb-8">Carta</h2>
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
    <section className="py-12 px-4 max-w-4xl mx-auto" id="menu">
      <h2 className="text-3xl font-bold text-center mb-8">Carta</h2>
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

function ReservasPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "reservas" }> }) {
  const { modo, url } = bloque.datos;
  return (
    <section className="py-12 px-4 max-w-3xl mx-auto text-center" id="reservas">
      <h2 className="text-3xl font-bold mb-4">Reservas</h2>
      {modo === "enlace_externo" && url ? (
        <a
          href={url}
          className="inline-block rounded-md bg-black text-white px-6 py-3 font-semibold"
          target="_blank"
          rel="noopener noreferrer"
        >
          Reservar ahora
        </a>
      ) : modo === "embed_cover" && url ? (
        <div className="aspect-video w-full">
          <iframe src={url} className="w-full h-full border-0 rounded-md" title="Reservas" />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Formulario de reserva (Fase 7 conecta con captura de leads).
        </p>
      )}
    </section>
  );
}

function TestimoniosPublico({
  bloque,
}: {
  bloque: Extract<Bloque, { tipo: "testimonios" }>;
}) {
  if (!bloque.datos.items.length) return null;
  return (
    <section className="py-12 px-4 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-8">Lo que dicen nuestros clientes</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {bloque.datos.items.map((t, i) => (
          <blockquote key={i} className="rounded-lg border p-5 bg-muted/20">
            {t.estrellas ? (
              <div className="text-yellow-500 mb-2">{"★".repeat(t.estrellas)}</div>
            ) : null}
            <p className="italic">&quot;{t.texto}&quot;</p>
            <footer className="mt-3 text-sm font-semibold">— {t.nombre}</footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function CtaPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "cta" }> }) {
  const { titulo, texto, boton } = bloque.datos;
  return (
    <section className="py-14 px-4 text-center bg-muted/30">
      <h2 className="text-3xl font-bold">{titulo}</h2>
      {texto ? <p className="mt-3 text-muted-foreground max-w-xl mx-auto">{texto}</p> : null}
      <a
        href={boton.href}
        className={`inline-block mt-6 rounded-md px-6 py-3 font-semibold ${
          boton.variante === "primary"
            ? "bg-black text-white"
            : "border border-black text-black hover:bg-black hover:text-white"
        }`}
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
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}&zoom=${zoom}`;
  return (
    <section className="py-12 px-4 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-4">Cómo llegar</h2>
      <p className="text-center text-muted-foreground mb-6">{direccion_texto}</p>
      <div className="aspect-[16/9] w-full rounded-md overflow-hidden border">
        <iframe src={src} className="w-full h-full" title="Mapa" />
      </div>
    </section>
  );
}

function FooterPublico({ bloque }: { bloque: Extract<Bloque, { tipo: "footer" }> }) {
  const { columnas, redes, texto_legal } = bloque.datos;
  return (
    <footer className="bg-black text-white py-10 px-4">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
        {columnas.map((c, i) => (
          <div key={i}>
            <h4 className="font-semibold mb-3">{c.titulo}</h4>
            <ul className="space-y-1 text-sm opacity-80">
              {c.items.map((it, j) => (
                <li key={j}>
                  <a href={it.href} className="hover:underline">
                    {it.label}
                  </a>
                </li>
              ))}
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
  return (
    <section className="py-10 px-4 max-w-3xl mx-auto">
      <div
        className="prose prose-lg max-w-none"
        dangerouslySetInnerHTML={{ __html: bloque.datos.html_seguro }}
      />
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
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <video
            src={url}
            controls
            autoPlay={autoplay}
            muted={muted}
            className="w-full h-full"
          />
        )}
      </div>
    </section>
  );
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
