"use client";

/**
 * Ajustes → Departamentos → SALA → Reservas
 * Quién puede DEVOLVER dinero ya cobrado a un cliente.
 *
 * Va aquí y no en el engranaje de Reservas a propósito: devolver no es un
 * ajuste de uso diario de la pantalla, es sacar dinero de la cuenta del
 * restaurante. Le corresponde el nivel de Ajustes, que es una barrera de
 * acceso más alta — quien gestiona reservas a diario no tiene por qué poder
 * decidir quién devuelve dinero.
 *
 * Se elige por DEPARTAMENTO, y de fábrica solo DIRECCIÓN. Lo que se marque
 * aquí decide quién ve el botón en la ficha de la reserva; el candado de
 * verdad está en el servidor, que vuelve a comprobar el departamento y pide
 * la contraseña antes de mover un euro.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import {
  getReservasConfig,
  upsertReservasConfig,
  getDepartamentosEmpresa,
} from "@/features/sala/actions/reservas-config-actions";

export function DevolucionesReservasPanel() {
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [valor, setValor] = useState<string[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vivo = true;
    Promise.all([getDepartamentosEmpresa(), getReservasConfig()]).then(
      ([deps, cfg]) => {
        if (!vivo) return;
        setDepartamentos(deps);
        setValor(cfg.ok ? (cfg.data?.devolucionDepartamentos ?? []) : []);
      },
    );
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(nombre: string) {
    if (!valor || guardando) return;
    const siguiente = valor.includes(nombre)
      ? valor.filter((d) => d !== nombre)
      : [...valor, nombre];

    // Se pinta ya y se guarda detrás: si el guardado falla se deshace, para
    // que la pantalla nunca enseñe una autorización que no está grabada.
    setValor(siguiente);
    setGuardando(true);
    const res = await upsertReservasConfig({ devolucionDepartamentos: siguiente });
    setGuardando(false);
    if (!res.ok) {
      setValor(valor);
      toast.error("No se pudo guardar");
      return;
    }
    toast.success("Guardado");
  }

  if (valor == null) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Departamentos que pueden devolver cobros a clientes
      </p>

      {/* Misma rejilla de casillas que los campos obligatorios de arriba: es
          el patrón de esta pantalla y las dos listas se leen igual. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {departamentos.map((d) => {
          const activo = valor.includes(d);
          return (
            <button
              key={d}
              type="button"
              disabled={guardando}
              onClick={() => void alternar(d)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-all cursor-pointer disabled:opacity-60 ${
                activo
                  ? "border-primary/50 bg-primary/5 hover:shadow-sm"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 ${
                  activo ? "bg-primary border-primary" : "border-muted-foreground/40"
                }`}
              >
                {activo && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </div>
              <span className="text-xs">{d}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {valor.length === 0
          ? "Sin ningún departamento marcado, nadie podrá devolver dinero."
          : "Verán el botón de devolver en la ficha de la reserva y tendrán que teclear su contraseña para usarlo."}
      </p>
    </div>
  );
}
