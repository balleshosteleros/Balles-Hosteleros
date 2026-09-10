"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileCheck2, BellRing, Loader2, Megaphone, Paperclip } from "lucide-react";
import {
  listNotificacionesPendientes,
  marcarNotificacionVista,
  accionarLiquidacion,
  type NotificacionApp,
} from "@/features/notificaciones/actions/notificaciones-actions";
import {
  normalizarAdjuntos,
  tamanoLegible,
  urlAdjuntoComunicado,
} from "@/features/gerencia/data/comunicados-adjuntos";

function fmt(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " €";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0);
}

// Cola de notificaciones sin ver: al entrar a la app saltan en secuencia y el
// empleado debe pulsar Visto / LIQUIDAR para quitarlas.
export function NotificacionesGate() {
  const [pend, setPend] = useState<NotificacionApp[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasoTexto, setPasoTexto] = useState(false); // 2º paso de la liquidación

  useEffect(() => {
    let on = true;
    listNotificacionesPendientes().then((r) => {
      if (on) setPend(r);
    });
    return () => {
      on = false;
    };
  }, []);

  const actual = pend[0];
  if (!actual) return null;

  const esLiquidacion = actual.tipo === "liquidacion" && actual.requiereAccion && !!actual.refId;
  const esComunicado = actual.tipo === "comunicado";
  // El comunicado se lee ENTERO aquí mismo, con sus documentos: el trabajador no
  // tiene que ir a buscarlo a otra pantalla para enterarse de lo que le afecta.
  const cuerpoComunicado = esComunicado
    ? ((actual.payload.cuerpo as string | undefined) ?? actual.mensaje ?? "")
    : "";
  const adjuntos = esComunicado ? normalizarAdjuntos(actual.payload.adjuntos) : [];
  const siguiente = () => {
    setPasoTexto(false);
    setPend((prev) => prev.slice(1));
  };

  const onVisto = async () => {
    setBusy(true);
    const r = await marcarNotificacionVista(actual.id);
    setBusy(false);
    if (r.ok) siguiente();
  };

  const onConfirmarLiquidar = async () => {
    setBusy(true);
    const r = await accionarLiquidacion(actual.id, actual.refId as string);
    setBusy(false);
    if (r.ok) siguiente();
  };

  // 2º paso: aviso del primer miércoles (texto editable de la empresa).
  if (esLiquidacion && pasoTexto) {
    const texto =
      (actual.payload.textoLiquidar as string) ||
      "Las liquidaciones se emiten siempre el primer miércoles del mes.";
    return (
      <AlertDialog open>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Liquidación aprobada</AlertDialogTitle>
            <AlertDialogDescription>{texto}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onConfirmarLiquidar();
              }}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entendido"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const conceptos: { label: string; value: number }[] = esLiquidacion
    ? [
        { label: "Pago", value: num(actual.payload.pago) },
        { label: "Nómina", value: num(actual.payload.nomina) },
        { label: "Complemento", value: num(actual.payload.complemento) },
        { label: "Horas extras", value: num(actual.payload.horasExtras) },
        { label: "Bonus", value: num(actual.payload.bonus) },
        { label: "Ajuste", value: num(actual.payload.ajuste) },
      ].filter((c) => c.value !== 0)
    : [];

  return (
    <AlertDialog open>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              {esLiquidacion ? (
                <FileCheck2 className="h-5 w-5" />
              ) : esComunicado ? (
                <Megaphone className="h-5 w-5" />
              ) : (
                <BellRing className="h-5 w-5" />
              )}
            </span>
            {actual.titulo}
          </AlertDialogTitle>
          {actual.mensaje && !esLiquidacion && !esComunicado && (
            <AlertDialogDescription>{actual.mensaje}</AlertDialogDescription>
          )}
        </AlertDialogHeader>

        {esComunicado && (cuerpoComunicado || adjuntos.length > 0) && (
          <div className="space-y-3">
            {cuerpoComunicado && (
              <div className="max-h-64 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {cuerpoComunicado}
              </div>
            )}
            {adjuntos.length > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {adjuntos.length === 1 ? "Documento adjunto" : "Documentos adjuntos"}
                </p>
                {adjuntos.map((a) => (
                  <a
                    key={a.path}
                    href={urlAdjuntoComunicado(a.path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                    {a.size > 0 && (
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {tamanoLegible(a.size)}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {esLiquidacion && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <dl className="space-y-1.5">
              {conceptos.map((c) => (
                <div key={c.label} className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{c.label}</dt>
                  <dd className="tabular-nums">
                    {c.value > 0 ? fmt(c.value) : `−${fmt(Math.abs(c.value))}`}
                  </dd>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{fmt(num(actual.payload.total))}</dd>
              </div>
            </dl>
          </div>
        )}

        {pend.length > 1 && (
          <p className="text-center text-xs text-muted-foreground">
            Tienes {pend.length} notificaciones sin ver.
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (esLiquidacion) setPasoTexto(true);
              else void onVisto();
            }}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : actual.accionLabel || "Visto"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
