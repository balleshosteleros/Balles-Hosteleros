"use client";

/**
 * Auditoría de correos: cuánto correo mueve cada buzón y con quién
 * (PRP-094, Fase 3).
 *
 * La pantalla responde a dos preguntas, en este orden:
 *   1. ¿Cuánto correo mueve este buzón? → las cifras de arriba y la gráfica.
 *   2. ¿CON QUIÉN? → la tabla, que es la que manda: contactos de más a menos,
 *      con el acumulado, y la línea del 80 % marcada.
 *
 * No clasifica nada ni usa IA: solo cuenta y ordena. La única ayuda es el
 * interruptor para apagar boletines y `no-reply`, que no son trabajo de nadie.
 */

import { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getPanelCorreoAction } from "../actions/metricas-actions";
import { CorreoKpis } from "./CorreoKpis";
import { CorreoContactosTabla } from "./CorreoContactosTabla";
import { CorreoVolumenChart } from "./CorreoVolumenChart";
import type { DatosPanelCorreo, Periodo } from "../types";

const PERIODOS: { valor: Periodo; texto: string }[] = [
  { valor: "dia", texto: "Hoy" },
  { valor: "semana", texto: "Esta semana" },
  { valor: "mes", texto: "Este mes" },
];

export function CorreoAuditoriaView() {
  const { empresaActual } = useEmpresa();

  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [buzonId, setBuzonId] = useState<string | null>(null);
  const [porDominio, setPorDominio] = useState(false);
  const [incluirAutomaticos, setIncluirAutomaticos] = useState(false);

  const [datos, setDatos] = useState<DatosPanelCorreo | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    getPanelCorreoAction({ periodo, buzonId, porDominio, incluirAutomaticos })
      .then(setDatos)
      .finally(() => setCargando(false));
  }, [periodo, buzonId, porDominio, incluirAutomaticos]);

  useEffect(() => {
    cargar();
  }, [cargar, empresaActual?.id]);

  // Un solo icono de carga, centrado: la pantalla entera se repinta de golpe.
  if (cargando && !datos) return <LoadingSpinner size="lg" />;
  if (!datos) return null;

  const sinConectar = datos.buzones.filter((b) => b.conexion === "sin_conectar");
  const caducados = datos.buzones.filter((b) => b.conexion === "caducado");

  return (
    <div className="space-y-4 pb-28">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto flex items-center gap-2 text-lg font-semibold">
          <Mail className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          Correo
        </h1>

        <Select
          value={buzonId ?? "todos"}
          onValueChange={(v) => setBuzonId(v === "todos" ? null : v)}
        >
          <SelectTrigger className="h-9 w-56">
            <SelectValue placeholder="Buzón" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los buzones</SelectItem>
            {datos.buzones
              .filter((b) => b.conexion !== "sin_conectar")
              .map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.etiqueta}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((p) => (
              <SelectItem key={p.valor} value={p.valor}>
                {p.texto}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* El rango en palabras: quien mira tiene que saber qué está contando. */}
      <div className="text-xs text-muted-foreground">{datos.rango.etiqueta}</div>

      {!datos.hayBuzonesConectados ? (
        <div className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay ningún buzón conectado, así que no hay nada que contar.
          Los buzones se conectan en Ajustes, en Integraciones.
        </div>
      ) : (
        <>
          <CorreoKpis
            entrantes={datos.totalEntrantes}
            salientes={datos.totalSalientes}
            mediaDiaria={datos.mediaDiaria}
            contactos={datos.contactosDistintos}
          />

          <div className="flex flex-wrap items-center gap-6 rounded-md border px-3 py-2">
            <div className="flex items-center gap-2">
              <Switch
                id="por-dominio"
                checked={porDominio}
                onCheckedChange={setPorDominio}
              />
              <Label htmlFor="por-dominio" className="text-xs font-normal">
                Agrupar por empresa
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="automaticos"
                checked={incluirAutomaticos}
                onCheckedChange={setIncluirAutomaticos}
              />
              <Label htmlFor="automaticos" className="text-xs font-normal">
                Incluir boletines y avisos automáticos
              </Label>
            </div>
          </div>

          <CorreoContactosTabla
            ranking={datos.ranking}
            porDominio={porDominio}
          />

          <CorreoVolumenChart serie={datos.serie} />
        </>
      )}

      {/* Un buzón que no se puede leer NO es un buzón con cero correo: se dice
          con esas palabras, para que nadie lea el panel de menos. */}
      {caducados.length > 0 ? (
        <p className="text-xs text-amber-700">
          {caducados.length === 1
            ? "Un buzón ha perdido el permiso en Google y no se está contando: "
            : `${caducados.length} buzones han perdido el permiso en Google y no se están contando: `}
          {caducados.map((b) => b.etiqueta).join(", ")}.
        </p>
      ) : null}

      {sinConectar.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {sinConectar.length === 1
            ? "Queda 1 buzón sin conectar, así que su correo no entra en estos números: "
            : `Quedan ${sinConectar.length} buzones sin conectar, así que su correo no entra en estos números: `}
          {sinConectar.map((b) => b.etiqueta).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
