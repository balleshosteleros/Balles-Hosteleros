"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, CheckCircle2, Lock, Clock, CalendarClock, Info } from "lucide-react";
import {
  periodoALabel,
  MODELO_LABEL,
  TIPOS_SOLO_DOCUMENTO,
  estadoVisualModelo,
  ESTADO_VISUAL_LABEL,
} from "../types/modelos";
import type { EstadoVisualModelo, ModeloAeat } from "../types/modelos";
import { ModeloPdfButton } from "./ModeloPdfButton";
import { SolicitarGestoriaButton } from "./SolicitarGestoriaButton";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaHoraEnZona } from "@/features/empresa/lib/zona-horaria";

/** Estilo del badge de estado visual (color + icono). */
const ESTADO_VISUAL_STYLE: Record<
  EstadoVisualModelo,
  { clase: string; Icono: typeof FileText }
> = {
  PRESENTADO: { clase: "bg-green-100 text-green-800 border-green-200", Icono: CheckCircle2 },
  SOLICITADO: { clase: "bg-sky-100 text-sky-800 border-sky-200", Icono: Info },
  FUERA_PLAZO: { clase: "bg-red-100 text-red-800 border-red-200", Icono: AlertTriangle },
  EN_PLAZO: { clase: "bg-amber-100 text-amber-800 border-amber-200", Icono: Clock },
  SIN_ABRIR: { clase: "bg-slate-100 text-slate-700 border-slate-200", Icono: CalendarClock },
};

export function ModeloCard({ modelo }: { modelo: ModeloAeat }) {
  const { empresaActual } = useEmpresa();
  const soloDocumento = TIPOS_SOLO_DOCUMENTO.includes(modelo.tipo);
  const estadoVisual = estadoVisualModelo(modelo);
  const { clase, Icono } = ESTADO_VISUAL_STYLE[estadoVisual];
  const presentado = estadoVisual === "PRESENTADO";
  // El botón de solicitar a gestoría tiene sentido cuando el modelo aún no está
  // presentado: en plazo, fuera de plazo o ya solicitado (para ver el estado).
  const puedeSolicitar = !presentado;

  const resultado =
    (modelo.casillas?.["69"] as number | undefined) ??
    (modelo.casillas?.["19"] as number | undefined) ??
    (modelo.casillas?.["28"] as number | undefined) ??
    (modelo.casillas?.["06"] as number | undefined) ??
    (modelo.casillas?.["660"] as number | undefined);

  return (
    <Link href={`/gestoria/modelos/${modelo.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {MODELO_LABEL[modelo.tipo]}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {periodoALabel(modelo.periodo, modelo.ejercicio)}
              </p>
            </div>
            {presentado ? <Lock className="h-4 w-4 text-green-600" /> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`gap-1 ${clase}`}>
              <Icono className="h-3 w-3" />
              {ESTADO_VISUAL_LABEL[estadoVisual]}
            </Badge>
          </div>

          {soloDocumento ? (
            <p className="text-sm text-muted-foreground italic">
              Documento anual de la gestoría
            </p>
          ) : resultado !== undefined && resultado !== 0 ? (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">Resultado</p>
              <p
                className={`text-lg font-bold ${
                  resultado > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {resultado > 0 ? "A ingresar" : "A devolver/compensar"}:{" "}
                {Math.abs(resultado).toLocaleString("es-ES", {
                  style: "currency",
                  currency: "EUR",
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin calcular</p>
          )}

          {modelo.ia_corrida_en ? (
            <p className="text-xs text-muted-foreground">
              IA ejecutada: {formatFechaHoraEnZona(modelo.ia_corrida_en, empresaActual?.zonaHoraria ?? "")}
            </p>
          ) : null}

          <div className="pt-2 border-t flex items-center justify-between gap-2">
            {puedeSolicitar ? (
              <SolicitarGestoriaButton
                modeloId={modelo.id}
                solicitado={estadoVisual === "SOLICITADO"}
              />
            ) : (
              <span />
            )}
            <ModeloPdfButton modeloId={modelo.id} tienePdf={Boolean(modelo.pdf_url)} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
