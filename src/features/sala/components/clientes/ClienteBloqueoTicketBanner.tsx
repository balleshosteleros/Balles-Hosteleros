"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  desbloquearClienteTicket,
  listBloqueosClienteTicket,
  type ClienteTicketBloqueo,
} from "@/features/sala/actions/clientes-actions";

interface Props {
  clienteId: string;
}

export function ClienteBloqueoTicketBanner({ clienteId }: Props) {
  const [bloqueos, setBloqueos] = useState<ClienteTicketBloqueo[]>([]);
  const [loading, setLoading] = useState(true);
  const [desbloqueandoId, setDesbloqueandoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const r = await listBloqueosClienteTicket(clienteId);
    if (r.ok) setBloqueos(r.data);
    setLoading(false);
  }, [clienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const activos = bloqueos.filter((b) => b.desbloqueadoAt === null);
  if (loading || activos.length === 0) return null;

  async function handleDesbloquear(id: string) {
    setDesbloqueandoId(id);
    try {
      const r = await desbloquearClienteTicket(id);
      if (!r.ok) {
        toast.error(r.error ?? "No se pudo desbloquear");
        return;
      }
      toast.success("Cliente desbloqueado");
      cargar();
    } finally {
      setDesbloqueandoId(null);
    }
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-red-900">
            Cliente bloqueado para reservas con ticket
          </p>
          <p className="text-xs text-red-800">
            {activos.length === 1
              ? "Tiene 1 inasistencia previa registrada."
              : `Tiene ${activos.length} inasistencias previas registradas.`}
            {" "}No podrá comprar nuevos tickets hasta que se desbloquee.
          </p>
        </div>
      </div>
      <ul className="text-[11px] text-red-900 pl-6 space-y-1">
        {activos.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2">
            <span>
              {b.motivo === "no_show" ? "No-show" : b.motivo === "manual" ? "Manual" : "Otro"} ·{" "}
              {new Date(b.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] px-2"
              onClick={() => handleDesbloquear(b.id)}
              disabled={desbloqueandoId === b.id}
            >
              {desbloqueandoId === b.id ? "Desbloqueando…" : "Desbloquear"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
