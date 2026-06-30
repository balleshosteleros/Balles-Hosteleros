"use client";

/**
 * Importador de fichas técnicas (escandallos) desde Excel — PRP-071, Fase 3.
 * Sube el Excel, muestra el emparejado propuesto y deja que el usuario
 * confirme / corrija / marque elaboración / marque "falta" antes de importar.
 * La importación real (escritura) es de la Fase 4 — aquí solo previsualiza y
 * captura las decisiones.
 */

import { useCallback, useMemo, useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  previewFichas,
  importarFichas,
  type ImportInforme,
  type ImportPayload,
} from "@/features/cocina/actions/import-fichas-actions";
import type {
  PreviewLinea,
  PreviewResult,
  Candidato,
} from "@/features/cocina/services/import-fichas/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, CheckCircle2, AlertTriangle, HelpCircle, Boxes } from "lucide-react";
import { toast } from "sonner";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { CorregirMatchDialog } from "./CorregirMatchDialog";

/** Decisión del usuario sobre cada línea. */
type DecisionTipo = "confirmado" | "corregido" | "elaboracion" | "falta" | "pendiente";

interface DecisionLinea {
  decision: DecisionTipo;
  /** Candidato elegido tras corregir (sobreescribe el sugerido). */
  candidatoElegido?: Candidato | null;
}

function keyLinea(l: PreviewLinea, i: number): string {
  return `${l.plato}__${l.ingrediente}__${i}`;
}

const TIPO_BADGE: Record<
  PreviewLinea["match"]["tipo"],
  { label: string; cls: string }
> = {
  exacto: { label: "Exacto", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  probable: { label: "Probable", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  dudoso: { label: "Dudoso", cls: "bg-rose-100 text-rose-700 border-rose-200" },
  sin_candidato: { label: "Sin candidato", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function ImportFichasView() {
  const { empresaActual } = useEmpresa();
  const [cargando, setCargando] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, DecisionLinea>>({});
  const [editando, setEditando] = useState<{ key: string; linea: PreviewLinea } | null>(null);
  const [importando, setImportando] = useState(false);
  const [informe, setInforme] = useState<ImportInforme | null>(null);

  const onArchivo = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setCargando(true);
      setPreview(null);
      try {
        const buf = await file.arrayBuffer();
        // ArrayBuffer → base64 para pasarlo al server action.
        let binary = "";
        const bytes = new Uint8Array(buf);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        const base64 = btoa(binary);

        const res = await previewFichas(base64);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setPreview(res.data);

        // Pre-decidir: los exactos quedan confirmados de inicio.
        const init: Record<string, DecisionLinea> = {};
        res.data.lineas.forEach((l, i) => {
          init[keyLinea(l, i)] =
            l.match.tipo === "exacto"
              ? { decision: "confirmado" }
              : { decision: "pendiente" };
        });
        setDecisiones(init);
        toast.success(`${res.data.resumen.platos} platos leídos`);
      } catch {
        toast.error("No se pudo leer el archivo.");
      } finally {
        setCargando(false);
      }
    },
    []
  );

  const setDecision = useCallback((key: string, d: DecisionLinea) => {
    setDecisiones((prev) => ({ ...prev, [key]: d }));
  }, []);

  // Líneas agrupadas por plato para el render.
  const porPlato = useMemo(() => {
    if (!preview) return [];
    const map = new Map<string, { linea: PreviewLinea; key: string }[]>();
    preview.lineas.forEach((l, i) => {
      const k = keyLinea(l, i);
      if (!map.has(l.plato)) map.set(l.plato, []);
      map.get(l.plato)!.push({ linea: l, key: k });
    });
    return Array.from(map.entries());
  }, [preview]);

  const resumenDecisiones = useMemo(() => {
    const vals = Object.values(decisiones);
    return {
      confirmados: vals.filter((d) => d.decision === "confirmado" || d.decision === "corregido").length,
      elaboraciones: vals.filter((d) => d.decision === "elaboracion").length,
      faltan: vals.filter((d) => d.decision === "falta").length,
      pendientes: vals.filter((d) => d.decision === "pendiente").length,
    };
  }, [decisiones]);

  const hayPendientes = resumenDecisiones.pendientes > 0;

  const onImportar = useCallback(async () => {
    if (!preview) return;
    // Construir payload agrupado por plato a partir de las decisiones.
    const platosMap = new Map<string, ImportPayload["platos"][number]>();
    preview.lineas.forEach((l, i) => {
      const key = keyLinea(l, i);
      const d = decisiones[key];
      if (!platosMap.has(l.plato)) {
        platosMap.set(l.plato, { plato: l.plato, categoria: null, lineas: [] });
      }
      const elegido = d?.candidatoElegido ?? l.match.candidato;
      const esFalta = d?.decision === "falta" || d?.decision === "pendiente";
      platosMap.get(l.plato)!.lineas.push({
        ingrediente: l.ingrediente,
        cantidad: l.cantidad,
        unidad: l.unidad,
        productoId: esFalta ? null : elegido?.id ?? null,
        tipo: esFalta ? null : elegido?.tipo ?? null,
        falta: esFalta,
      });
    });

    setImportando(true);
    try {
      const res = await importarFichas({ platos: Array.from(platosMap.values()) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setInforme(res.informe);
      toast.success(
        `${res.informe.creados} creadas · ${res.informe.actualizados} actualizadas`
      );
    } catch {
      toast.error("Falló la importación.");
    } finally {
      setImportando(false);
    }
  }, [preview, decisiones]);

  // Pantalla de informe final.
  if (informe) {
    return (
      <div className="space-y-6 pb-28">
        <h1 className="text-2xl font-semibold">Importación completada</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ResumenCard icon={<CheckCircle2 className="size-4" />} label="Creadas" valor={informe.creados} />
          <ResumenCard icon={<CheckCircle2 className="size-4" />} label="Actualizadas" valor={informe.actualizados} />
          <ResumenCard icon={<AlertTriangle className="size-4" />} label="Faltan (a dar de alta)" valor={informe.faltan.length} />
          <ResumenCard icon={<HelpCircle className="size-4" />} label="Platos con error" valor={informe.fallidos.length} />
        </div>

        {informe.faltan.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-medium mb-2">Productos a dar de alta</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Estos ingredientes no se importaron porque no existían. Dalos de
                alta en Productos y vuelve a importar para completarlos.
              </p>
              <ul className="text-sm space-y-1">
                {informe.faltan.map((f, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">{f.plato}:</span> {f.ingrediente}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {informe.fallidos.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h3 className="font-medium mb-2 text-rose-600">Platos con error</h3>
              <ul className="text-sm space-y-1">
                {informe.fallidos.map((f, i) => (
                  <li key={i}>
                    {f.plato}: <span className="text-muted-foreground">{f.error}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Button
          variant="outline"
          onClick={() => {
            setInforme(null);
            setPreview(null);
            setDecisiones({});
          }}
        >
          Importar otro Excel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <div>
        <h1 className="text-2xl font-semibold">Importar fichas técnicas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sube el Excel de platos. El sistema propone a qué producto corresponde
          cada ingrediente; tú confirmas o corriges antes de importar. No se
          modifica nada hasta que pulses importar.
        </p>
      </div>

      {/* Zona de subida */}
      {!preview && (
        <Card>
          <CardContent className="py-10 flex flex-col items-center gap-4">
            {cargando ? (
              <LoadingSpinner />
            ) : (
              <>
                <Upload className="size-8 text-muted-foreground" />
                <label className="cursor-pointer">
                  <span className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                    Elegir Excel
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => onArchivo(e.target.files?.[0])}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Empresa activa: {empresaActual?.nombre ?? "—"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resumen + tabla */}
      {preview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResumenCard icon={<CheckCircle2 className="size-4" />} label="Confirmados" valor={resumenDecisiones.confirmados} />
            <ResumenCard icon={<Boxes className="size-4" />} label="Elaboraciones" valor={resumenDecisiones.elaboraciones} />
            <ResumenCard icon={<AlertTriangle className="size-4" />} label="Faltan" valor={resumenDecisiones.faltan} />
            <ResumenCard icon={<HelpCircle className="size-4" />} label="Pendientes" valor={resumenDecisiones.pendientes} />
          </div>

          <div className="text-sm text-muted-foreground">
            {preview.resumen.platos} platos · {preview.resumen.ingredientesUnicos} ingredientes ·{" "}
            {preview.resumen.exacto} exactos · {preview.resumen.probable} probables ·{" "}
            {preview.resumen.dudoso + preview.resumen.sinCandidato} a revisar
          </div>

          {porPlato.map(([plato, filas]) => (
            <Card key={plato}>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2">{plato}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente (Excel)</TableHead>
                      <TableHead>Cant.</TableHead>
                      <TableHead>Sugerido</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filas.map(({ linea, key }) => {
                      const d = decisiones[key];
                      const elegido = d?.candidatoElegido ?? linea.match.candidato;
                      const badge = TIPO_BADGE[linea.match.tipo];
                      return (
                        <TableRow key={key}>
                          <TableCell>{linea.ingrediente}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {linea.cantidad ?? "—"} {linea.unidad}
                          </TableCell>
                          <TableCell>
                            {d?.decision === "falta" ? (
                              <span className="text-rose-600 text-xs">Marcado como falta</span>
                            ) : elegido ? (
                              <span>
                                {elegido.nombre}{" "}
                                <span className="text-xs text-muted-foreground">
                                  [{elegido.tipo}]
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={badge.cls}>
                              {badge.label}
                              {linea.match.tipo === "probable" && elegido
                                ? ` ${Math.round(linea.match.score * 100)}%`
                                : ""}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DecisionBotones
                              decision={d?.decision ?? "pendiente"}
                              onConfirmar={() => setDecision(key, { decision: "confirmado" })}
                              onCorregir={() => setEditando({ key, linea })}
                              onFalta={() => setDecision(key, { decision: "falta" })}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          {/* Barra de acción */}
          <div className="sticky bottom-4 flex items-center justify-between rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
            <span className="text-sm text-muted-foreground">
              {hayPendientes
                ? `${resumenDecisiones.pendientes} líneas sin revisar (se importarán como "falta")`
                : "Todo revisado"}
            </span>
            <Button onClick={onImportar} disabled={importando}>
              {importando ? "Importando…" : "Importar"}
            </Button>
          </div>
        </>
      )}

      {editando && (
        <CorregirMatchDialog
          open
          linea={editando.linea}
          candidatos={preview?.candidatos ?? []}
          onClose={() => setEditando(null)}
          onElegir={(cand, esElaboracion) => {
            setDecision(editando.key, {
              decision: esElaboracion ? "elaboracion" : "corregido",
              candidatoElegido: cand,
            });
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function ResumenCard({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: number }) {
  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <div className="text-2xl font-semibold">{valor}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DecisionBotones({
  decision,
  onConfirmar,
  onCorregir,
  onFalta,
}: {
  decision: DecisionTipo;
  onConfirmar: () => void;
  onCorregir: () => void;
  onFalta: () => void;
}) {
  return (
    <div className="inline-flex gap-1">
      <Button
        size="sm"
        variant={decision === "confirmado" ? "default" : "outline"}
        onClick={onConfirmar}
      >
        Confirmar
      </Button>
      <Button size="sm" variant="outline" onClick={onCorregir}>
        Corregir
      </Button>
      <Button
        size="sm"
        variant={decision === "falta" ? "destructive" : "outline"}
        onClick={onFalta}
      >
        Falta
      </Button>
    </div>
  );
}
