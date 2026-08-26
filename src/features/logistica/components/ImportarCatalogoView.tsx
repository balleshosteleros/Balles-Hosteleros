"use client";

/**
 * Importar catálogo del TPV (Ágora) — pantalla de propuestas.
 *
 * El importador PROPONE y la persona APRUEBA (encargo de Iván, 25-ago). Nada se
 * escribe hasta pulsar el botón final, y lo que se escribe es sólo lo aprobado.
 *
 * Las filas se agrupan POR DECISIÓN, no alfabéticamente, para poder aprobar en
 * bloque: es lo que hace la tarea rápida cuando hay ~100 productos que revisar.
 */

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Link2,
  Loader2,
  PackagePlus,
  ShoppingCart,
  Tag,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";
import { formatEur } from "@/shared/lib/numero";
import {
  previsualizarCatalogoAgora,
  importarCatalogoAgora,
  type PrevisualizacionCatalogo,
} from "@/features/logistica/actions/importador-catalogo-actions";
import type {
  DecisionImportacion,
  PropuestaProducto,
} from "@/features/logistica/lib/importador-catalogo/clasificar";

// ─── PRESENTACIÓN DE CADA GRUPO ─────────────────────────────────────────────

const GRUPOS: Array<{
  decision: DecisionImportacion;
  titulo: string;
  ayuda: string;
  Icon: typeof PackagePlus;
  color: string;
  /** Si se importa por defecto al abrir la pantalla. */
  activoPorDefecto: boolean;
}> = [
  {
    decision: "venta",
    titulo: "Crear como producto de venta",
    ayuda: "Se venden en el TPV con precio de carta. Si existe su ficha de compra, se enlazan por escandallo.",
    Icon: Tag,
    color: "text-emerald-700 dark:text-emerald-400",
    activoPorDefecto: true,
  },
  {
    decision: "compra",
    titulo: "Crear como producto de compra",
    ayuda: "No se venden: entran por albarán y llevan stock.",
    Icon: ShoppingCart,
    color: "text-sky-700 dark:text-sky-400",
    activoPorDefecto: true,
  },
  {
    decision: "vincular",
    titulo: "Vincular con el que ya tienes",
    ayuda: "Ya existen creados a mano. Se les pone el identificador de Ágora en vez de duplicarlos.",
    Icon: Link2,
    color: "text-violet-700 dark:text-violet-400",
    activoPorDefecto: true,
  },
  {
    decision: "revisar",
    titulo: "Revisar antes de importar",
    ayuda: "Se venden en el TPV pero no tienen precio de carta. Ponles precio o déjalos fuera.",
    Icon: TriangleAlert,
    color: "text-amber-700 dark:text-amber-400",
    activoPorDefecto: false,
  },
  {
    decision: "descartar",
    titulo: "Descartar (no son productos)",
    ayuda: "Apuntes del TPV: cajones de IVA, aforo, suplementos de línea. No son mercancía.",
    Icon: Trash2,
    color: "text-muted-foreground",
    activoPorDefecto: false,
  },
];

const ETIQUETA_DECISION: Record<DecisionImportacion, string> = {
  venta: "Venta",
  compra: "Compra",
  elaboracion: "Elaboración",
  vincular: "Vincular",
  revisar: "Revisar",
  descartar: "Descartar",
};

const OPCIONES: DecisionImportacion[] = [
  "venta", "compra", "elaboracion", "vincular", "revisar", "descartar",
];

function euros(n: number | null): string {
  return n == null ? "—" : formatEur(n);
}

// ─── VISTA ──────────────────────────────────────────────────────────────────

export function ImportarCatalogoView() {
  const [cargando, setCargando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [previa, setPrevia] = useState<PrevisualizacionCatalogo | null>(null);

  /** Decisión efectiva por producto (la propuesta, o la que el usuario cambió). */
  const [decisiones, setDecisiones] = useState<Record<string, DecisionImportacion>>({});
  /** Qué líneas entran en la importación. */
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({});
  /** Cantidad del enlace venta→compra (bebidas). */
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  /** Precio puesto a mano cuando Ágora no lo trae. */
  const [precios, setPrecios] = useState<Record<string, string>>({});
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({
    venta: true, compra: true, vincular: true, revisar: true, descartar: false,
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await previsualizarCatalogoAgora();
    setPrevia(res);
    if (res.ok && res.propuestas) {
      const dec: Record<string, DecisionImportacion> = {};
      const sel: Record<string, boolean> = {};
      const cant: Record<string, string> = {};
      for (const p of res.propuestas) {
        dec[p.agoraId] = p.decision;
        sel[p.agoraId] =
          GRUPOS.find((g) => g.decision === p.decision)?.activoPorDefecto ?? false;
        if (p.parejaCompra) cant[p.agoraId] = "1";
      }
      setDecisiones(dec);
      setSeleccion(sel);
      setCantidades(cant);
    }
    setCargando(false);
  }, []);

  const propuestas = useMemo(() => previa?.propuestas ?? [], [previa]);

  /** Agrupa por la decisión EFECTIVA (si el usuario la cambia, cambia de grupo). */
  const porGrupo = useMemo(() => {
    const mapa = new Map<DecisionImportacion, PropuestaProducto[]>();
    for (const g of GRUPOS) mapa.set(g.decision, []);
    mapa.set("elaboracion", []);
    for (const p of propuestas) {
      const d = decisiones[p.agoraId] ?? p.decision;
      const arr = mapa.get(d);
      if (arr) arr.push(p);
    }
    return mapa;
  }, [propuestas, decisiones]);

  const aprobadas = useMemo(
    () => propuestas.filter((p) => seleccion[p.agoraId]),
    [propuestas, seleccion],
  );

  const totalAltas = aprobadas.filter((p) => {
    const d = decisiones[p.agoraId] ?? p.decision;
    return d === "venta" || d === "compra" || d === "elaboracion";
  }).length;
  const totalVinculos = aprobadas.filter(
    (p) => (decisiones[p.agoraId] ?? p.decision) === "vincular",
  ).length;

  function alternarGrupo(decision: DecisionImportacion, valor: boolean) {
    const ids = (porGrupo.get(decision) ?? []).map((p) => p.agoraId);
    setSeleccion((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = valor;
      return next;
    });
  }

  async function importar() {
    const lineas = aprobadas.map((p) => {
      const decision = decisiones[p.agoraId] ?? p.decision;
      const cantidadTexto = (cantidades[p.agoraId] ?? "").replace(",", ".");
      const precioTexto = (precios[p.agoraId] ?? "").replace(",", ".");
      return {
        agoraId: p.agoraId,
        decision,
        vincularAId: decision === "vincular" ? (p.existente?.id ?? null) : null,
        parejaCompraId: decision === "venta" ? (p.parejaCompra?.id ?? null) : null,
        cantidadEnlace: cantidadTexto ? Number(cantidadTexto) : null,
        precioVentaManual: precioTexto ? Number(precioTexto) : null,
      };
    });

    if (lineas.length === 0) {
      toast.error("No has aprobado ninguna línea");
      return;
    }

    setImportando(true);
    const res = await importarCatalogoAgora({ lineas });
    setImportando(false);

    if (!res.ok || !res.resultado) {
      toast.error(res.error ?? "No se pudo importar");
      return;
    }
    const r = res.resultado;
    const creados = r.creadosVenta + r.creadosCompra + r.creadosElaboracion;
    toast.success(
      `${creados} productos creados, ${r.vinculados} vinculados` +
        (r.enlacesEscandallo > 0 ? `, ${r.enlacesEscandallo} enlazados a su ficha de compra` : ""),
    );
    if (r.errores.length > 0) {
      toast.error(`${r.errores.length} líneas dieron error. Revisa el detalle.`);
      console.error("[importar-catalogo] errores:", r.errores);
    }
    void cargar();
  }

  // ─── Estados de carga y error ─────────────────────────────────────────────

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Leyendo el catálogo de Ágora…
      </div>
    );
  }

  // Aún no se ha leído nada: la lectura se dispara a mano, no al abrir.
  if (!previa) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6">
          <p className="font-medium">Importar el catálogo desde Ágora</p>
          <p className="text-sm text-muted-foreground">
            Leo los productos que hay en el TPV y te propongo qué hacer con cada uno: crearlo como
            producto de venta o de compra, vincularlo con uno que ya tengas, o descartarlo si no es
            mercancía. <strong>No se guarda nada hasta que apruebes.</strong>
          </p>
          <Button onClick={() => void cargar()}>
            <Download className="mr-2 h-4 w-4" />
            Leer el catálogo de Ágora
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!previa.ok) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="flex items-start gap-3 py-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">No se pudo leer el catálogo</p>
            <p className="mt-1 text-sm text-muted-foreground">{previa.error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void cargar()}>
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-28">
      {/* Límite de lectura: qué traemos y qué descartamos, a la vista */}
      <Card>
        <CardContent className="space-y-2 py-4 text-sm">
          <p>
            He leído <strong>{previa.totalEnAgora}</strong> productos de Ágora. Ya tienes{" "}
            <strong>{previa.yaVinculados}</strong> vinculados.
          </p>
          <p className="text-muted-foreground">
            Traigo <strong>nombre, precio de la lista de carta, coste del almacén, familia,
            stock</strong> y si se vende por peso. Descarto color de botón, tiempo de preparación,
            códigos de barras y las tarifas que no son la de carta.
          </p>
          {previa.omitidosOtroLocal ? (
            <p className="text-muted-foreground">
              No se muestran <strong>{previa.omitidosOtroLocal}</strong> productos porque su familia
              es del otro local. Sin este filtro entrarían en {previa.empresa} productos que no le
              corresponden.
            </p>
          ) : null}
          {previa.invalidos ? (
            <p className="text-amber-700 dark:text-amber-400">
              {previa.invalidos} registros de Ágora no se pudieron leer y quedan fuera.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Grupos */}
      {GRUPOS.map((grupo) => {
        const filas = porGrupo.get(grupo.decision) ?? [];
        if (filas.length === 0) return null;
        const todas = filas.every((p) => seleccion[p.agoraId]);
        const abierto = abiertos[grupo.decision] ?? true;
        const { Icon } = grupo;

        return (
          <Card key={grupo.decision}>
            <CardContent className="p-0">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setAbiertos((p) => ({ ...p, [grupo.decision]: !abierto }))
                  }
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={abierto ? "Contraer" : "Desplegar"}
                >
                  {abierto ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <Icon className={cn("h-4 w-4 shrink-0", grupo.color)} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {grupo.titulo}{" "}
                    <span className="text-muted-foreground">({filas.length})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{grupo.ayuda}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <Checkbox
                    checked={todas}
                    onCheckedChange={(v) => alternarGrupo(grupo.decision, v === true)}
                  />
                  Aceptar todo
                </label>
              </div>

              {abierto ? (
                <div className="divide-y">
                  {filas.map((p) => {
                    const decision = decisiones[p.agoraId] ?? p.decision;
                    const marcada = !!seleccion[p.agoraId];
                    return (
                      <div
                        key={p.agoraId}
                        className={cn(
                          "flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm",
                          !marcada && "opacity-55",
                        )}
                      >
                        <Checkbox
                          checked={marcada}
                          onCheckedChange={(v) =>
                            setSeleccion((s) => ({ ...s, [p.agoraId]: v === true }))
                          }
                        />

                        <select
                          value={decision}
                          onChange={(e) =>
                            setDecisiones((d) => ({
                              ...d,
                              [p.agoraId]: e.target.value as DecisionImportacion,
                            }))
                          }
                          className="h-8 rounded-md border bg-background px-2 text-xs"
                        >
                          {OPCIONES.map((o) => (
                            <option key={o} value={o}>
                              {ETIQUETA_DECISION[o]}
                            </option>
                          ))}
                        </select>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.familia} · {p.motivo}
                          </p>
                          {p.avisos.map((a) => (
                            <p
                              key={a}
                              className="mt-0.5 text-xs text-amber-700 dark:text-amber-400"
                            >
                              {a}
                            </p>
                          ))}
                        </div>

                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <p>{euros(p.precioVenta)}</p>
                          <p>coste {euros(p.coste)}</p>
                        </div>

                        {/* Precio a mano cuando Ágora no lo trae */}
                        {decision === "venta" && p.precioVenta == null ? (
                          <Input
                            value={precios[p.agoraId] ?? ""}
                            onChange={(e) =>
                              setPrecios((x) => ({ ...x, [p.agoraId]: e.target.value }))
                            }
                            placeholder="Precio"
                            className="h-8 w-24 shrink-0"
                            inputMode="decimal"
                          />
                        ) : null}

                        {/* Enlace con la ficha de compra (bebidas) */}
                        {decision === "venta" && p.parejaCompra ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Link2 className="h-3.5 w-3.5 text-violet-600" />
                            <span className="text-xs text-muted-foreground">
                              gasta
                            </span>
                            <Input
                              value={cantidades[p.agoraId] ?? "1"}
                              onChange={(e) =>
                                setCantidades((c) => ({ ...c, [p.agoraId]: e.target.value }))
                              }
                              className="h-8 w-20"
                              inputMode="decimal"
                            />
                            <span className="max-w-[10rem] truncate text-xs text-muted-foreground">
                              de {p.parejaCompra.nombre}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}

      {/* Barra de acción */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur md:left-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {totalAltas > 0 ? <strong>{totalAltas} altas</strong> : "Ninguna alta"}
            {totalVinculos > 0 ? ` · ${totalVinculos} vinculaciones` : ""}
          </p>
          <Button onClick={() => void importar()} disabled={importando || aprobadas.length === 0}>
            {importando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Importar {aprobadas.length}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
