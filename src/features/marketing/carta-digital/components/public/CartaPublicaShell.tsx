"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CartaPublica, CartaItem, Alergeno, FamiliaCarta } from "../../types";
import { buildCartaTheme, themeToCssVars, googleFontsHref } from "../../lib/theme";
import { useDeviceId } from "../../hooks/useDeviceId";
import { getLikesDelDevice, toggleLike } from "../../actions/like-actions";
import { useLikesRealtime } from "../../hooks/useLikesRealtime";
import { HeaderRestaurante } from "./HeaderRestaurante";
import { CategoriaSidebar } from "./CategoriaSidebar";
import { FiltroAlergenos } from "./FiltroAlergenos";
import { ItemList } from "./ItemList";
import { ItemFichaModal } from "./ItemFichaModal";

export function CartaPublicaShell({ carta }: { carta: CartaPublica }) {
  const theme = useMemo(() => buildCartaTheme(carta.empresa), [carta.empresa]);
  const cssVars = useMemo(() => themeToCssVars(theme), [theme]);
  const fontsHref = useMemo(
    () => googleFontsHref([theme.fuenteTitulos, theme.fuenteCuerpo]),
    [theme.fuenteTitulos, theme.fuenteCuerpo],
  );

  const deviceId = useDeviceId();
  // Familia activa: la carta se navega primero por COMIDA / BEBIDA.
  // Arranca por el primer apartado configurado: HABANA es coctelería y abre
  // por BEBIDA, no por comida.
  const familiasCfg = useMemo(
    () => [...(carta.familias ?? [])].sort((a, b) => a.orden - b.orden),
    [carta.familias],
  );
  const [familia, setFamilia] = useState<FamiliaCarta>(
    familiasCfg[0]?.clave ?? "comida",
  );
  const [activeCat, setActiveCat] = useState<string | null>(carta.categorias[0]?.id ?? null);
  const [openItem, setOpenItem] = useState<CartaItem | null>(null);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [filtroExcluidos, setFiltroExcluidos] = useState<Set<Alergeno>>(new Set());
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const catsFamilia = useMemo(
    () =>
      carta.categorias
        .filter((c) => (c.familia ?? "comida") === familia)
        .map((c) =>
          soloFavoritos ? { ...c, items: c.items.filter((i) => i.destacado) } : c,
        )
        // Con el filtro puesto, una categoría sin platos de la casa sobra: si se
        // deja, la carta se llena de titulares vacíos.
        .filter((c) => !soloFavoritos || c.items.length > 0),
    [carta.categorias, familia, soloFavoritos],
  );

  const itemIds = useMemo(
    () => carta.categorias.flatMap((c) => c.items.map((i) => i.id)),
    [carta.categorias],
  );

  const counters = useLikesRealtime(itemIds);

  useEffect(() => {
    if (!deviceId || itemIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const liked = await getLikesDelDevice(deviceId, itemIds);
      if (!cancelled) setLikedSet(new Set(liked));
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceId, itemIds]);

  // Scroll-spy: observa qué categoría es la más visible.
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("[data-cat-section]");
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = visible[0].target.getAttribute("data-cat-section");
          if (id) setActiveCat(id);
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [carta.categorias]);

  const totalItems = useMemo(
    () => carta.categorias.reduce((acc, c) => acc + c.items.length, 0),
    [carta.categorias],
  );

  const itemsVisibles = useMemo(() => {
    if (filtroExcluidos.size === 0) return totalItems;
    return carta.categorias.reduce(
      (acc, c) => acc + c.items.filter((i) => !i.alergenos.some((a) => filtroExcluidos.has(a))).length,
      0,
    );
  }, [carta.categorias, filtroExcluidos, totalItems]);

  const openItemFinal = openItem
    ? (counters[openItem.id] ?? openItem.likes_base + openItem.likes_count)
    : 0;

  const handleSelectCategoria = (id: string) => {
    setActiveCat(id);
    const el = document.getElementById(`cat-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /**
   * Votar desde la propia tarjeta, sin abrir la ficha. Se pinta el corazón al
   * instante y se corrige con lo que responda el servidor: esperar a la red
   * para un gesto tan pequeño hace que parezca que no ha funcionado.
   */
  const handleLikeRapido = async (item: CartaItem) => {
    if (!deviceId) return;
    const yaEstaba = likedSet.has(item.id);
    handleToggleLocalLike(item.id, !yaEstaba);
    const r = await toggleLike(item.id, deviceId);
    if (!r.ok) handleToggleLocalLike(item.id, yaEstaba);
  };

  const handleToggleLocalLike = (itemId: string, liked: boolean) => {
    setLikedSet((prev) => {
      const next = new Set(prev);
      if (liked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  return (
    <>
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <main style={cssVars} className="min-h-screen">
        <HeaderRestaurante empresa={carta.empresa} />

        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 pt-2 lg:grid-cols-[220px_1fr] lg:gap-12 lg:pt-8">
            <CategoriaSidebar
              categorias={carta.categorias}
              activeId={activeCat}
              onSelect={handleSelectCategoria}
              familia={familia}
              familiasCfg={familiasCfg}
              onFamilia={(f) => {
                setFamilia(f);
                // Al cambiar de familia el ancla anterior ya no existe: se
                // vuelve arriba en vez de dejar la vista a medio camino.
                setActiveCat(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            />

            <div className="min-w-0">
              <ItemList
                ref={listRef}
                categorias={catsFamilia}
                filtroExcluidos={filtroExcluidos}
                counters={counters}
                likedSet={likedSet}
                onOpen={setOpenItem}
                onLike={handleLikeRapido}
              />
            </div>
          </div>
        </div>

        {/* Firma del software, igual que en la web pública: discreta, al final
            del todo y sin logo. La carta es del restaurante; esto solo dice
            quién la mueve por detrás. */}
        <footer
          className="mx-auto max-w-6xl px-4 pb-10 pt-2 text-center text-[11px] sm:px-6"
          style={{ color: "var(--carta-texto-tenue)" }}
        >
          Tecnología por{" "}
          <a
            href="https://software.balleshosteleros.com"
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline-offset-2 transition-opacity hover:underline hover:opacity-90"
          >
            Software Balles Hosteleros
          </a>
        </footer>

        <FiltroAlergenos
          excluidos={filtroExcluidos}
          onChange={setFiltroExcluidos}
          totalItems={totalItems}
          itemsVisibles={itemsVisibles}
          soloFavoritos={soloFavoritos}
          onSoloFavoritos={setSoloFavoritos}
        />

        <ItemFichaModal
          item={openItem}
          deviceId={deviceId}
          liked={openItem ? likedSet.has(openItem.id) : false}
          likesCount={openItemFinal}
          onClose={() => setOpenItem(null)}
          onToggleLocalLike={handleToggleLocalLike}
        />
      </main>
    </>
  );
}
