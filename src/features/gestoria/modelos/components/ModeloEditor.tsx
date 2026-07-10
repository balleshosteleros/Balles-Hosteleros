"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Sparkles,
  FileDown,
  FileText,
  Loader2,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AsignacionModelo,
  FacturaParaModelo,
  ModeloAeat,
} from "../types/modelos";
import {
  periodoALabel,
  estadoVisualModelo,
  ESTADO_VISUAL_LABEL,
  diasHastaFinPlazo,
} from "../types/modelos";
import { Modelo303Editor } from "./editors/Modelo303Editor";
import { Modelo130Editor } from "./editors/Modelo130Editor";
import { Modelo111Editor } from "./editors/Modelo111Editor";
import { Modelo115Editor } from "./editors/Modelo115Editor";
import { Modelo390Editor } from "./editors/Modelo390Editor";
import { Modelo347Editor } from "./editors/Modelo347Editor";
import { FacturasSinClasificar } from "./FacturasSinClasificar";
import { CuadreBadge } from "./CuadreBadge";
import { SolicitarGestoriaButton } from "./SolicitarGestoriaButton";
import { SubirDocumentoModeloButton } from "./SubirDocumentoModeloButton";
import { correrIA } from "../actions/categorizacion-actions";
import { validarCuadre } from "../services/validar-cuadre";

interface Props {
  modelo: ModeloAeat;
  facturas: FacturaParaModelo[];
  asignaciones: AsignacionModelo[];
  registros347?: Array<{
    contacto_id: string;
    nif: string;
    nombre: string;
    tipo_contacto: string;
    clave: string;
    importe_t1: number;
    importe_t2: number;
    importe_t3: number;
    importe_t4: number;
    importe_total: number;
  }>;
}

export function ModeloEditor({ modelo, facturas, asignaciones, registros347 }: Props) {
  const router = useRouter();
  const [iaEjecutando, setIaEjecutando] = useState(false);

  const presentado = modelo.estado === "PRESENTADO";
  const editable = !presentado;
  const esAnual = modelo.tipo === "347" || modelo.tipo === "390";

  // Estado visual (plazo/solicitud/presentado), con cuenta atrás en "En plazo".
  const estadoVisual = estadoVisualModelo(modelo);
  const diasPlazo = estadoVisual === "EN_PLAZO" ? diasHastaFinPlazo(modelo) : null;
  const etiquetaEstadoVisual =
    estadoVisual === "EN_PLAZO" && diasPlazo !== null
      ? diasPlazo <= 0
        ? "En plazo · último día"
        : `En plazo · ${diasPlazo} ${diasPlazo === 1 ? "día" : "días"}`
      : ESTADO_VISUAL_LABEL[estadoVisual];

  async function handleCorrerIA() {
    if (!editable) return;
    setIaEjecutando(true);
    try {
      const res = await correrIA(modelo.id);
      if (!res.ok) alert(`Error: ${res.error}`);
      else {
        alert(
          `IA completada: ${res.asignaciones} facturas clasificadas (${res.dudosas} dudosas). Tokens: ${res.tokensInput} / ${res.tokensOutput}.`,
        );
        router.refresh();
      }
    } finally {
      setIaEjecutando(false);
    }
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/gestoria/modelos">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Modelos
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Modelo {modelo.tipo} · {periodoALabel(modelo.periodo, modelo.ejercicio)}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={
                  presentado
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }
              >
                {presentado ? <Lock className="h-3 w-3 mr-1" /> : null}
                {etiquetaEstadoVisual}
              </Badge>
              {modelo.hash_snapshot ? (
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                  hash:{modelo.hash_snapshot.slice(0, 16)}...
                </span>
              ) : null}
              {!esAnual ? (
                <CuadreBadge
                  resultado={validarCuadre(modelo.tipo, modelo.casillas ?? {}, facturas)}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {editable && !esAnual ? (
            <Button onClick={handleCorrerIA} disabled={iaEjecutando} size="sm">
              {iaEjecutando ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Correr IA · clasificar {facturas.length} facturas
            </Button>
          ) : null}
          {!presentado ? (
            <>
              <SolicitarGestoriaButton
                modeloId={modelo.id}
                solicitado={Boolean(modelo.solicitud_gestoria_en)}
                className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent disabled:opacity-50"
              />
              <SubirDocumentoModeloButton modeloId={modelo.id} />
            </>
          ) : null}
          <Link href={`/api/modelos-aeat/${modelo.id}/pdf`} target="_blank">
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </Link>
          <Link href={`/api/modelos-aeat/${modelo.id}/fichero`} target="_blank">
            <Button variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1" />
              Fichero AEAT
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        <div className="min-w-0">
          {modelo.tipo === "303" ? (
            <Modelo303Editor modelo={modelo} facturas={facturas} asignaciones={asignaciones} />
          ) : modelo.tipo === "130" ? (
            <Modelo130Editor modelo={modelo} facturas={facturas} asignaciones={asignaciones} />
          ) : modelo.tipo === "111" ? (
            <Modelo111Editor modelo={modelo} facturas={facturas} asignaciones={asignaciones} />
          ) : modelo.tipo === "115" ? (
            <Modelo115Editor modelo={modelo} facturas={facturas} asignaciones={asignaciones} />
          ) : modelo.tipo === "390" ? (
            <Modelo390Editor modelo={modelo} />
          ) : modelo.tipo === "347" ? (
            <Modelo347Editor modelo={modelo} registros={registros347 ?? []} />
          ) : null}
        </div>

        {!esAnual ? (
          <aside className="space-y-3">
            <FacturasSinClasificar
              modeloId={modelo.id}
              modeloTipo={modelo.tipo}
              facturas={facturas}
              asignaciones={asignaciones}
              onReasignada={() => router.refresh()}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
