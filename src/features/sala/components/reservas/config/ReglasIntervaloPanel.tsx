"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reglaToVigencia } from "@/features/sala/reglas/data/reglas";
import {
  type EmpresaReservasIntervaloRegla,
  type MetricaIntervalo,
  METRICA_INTERVALO_LABELS,
  METRICA_INTERVALO_UNIDADES,
} from "@/features/sala/reglas/data/reglas-intervalo";
import {
  deleteReglaIntervalo,
  listReglasIntervalo,
} from "@/features/sala/reglas/actions/reglas-intervalo-actions";
import { VigenciaBadge } from "@/features/sala/reglas/components/VigenciaBadge";
import { ReglaIntervaloModal } from "./ReglaIntervaloModal";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

/**
 * Panel de reglas de intervalo: límites de "máx reservas por franja" y
 * "máx personas por franja", con periodicidad. Va dentro de la pestaña
 * "Configuración" de Reservas.
 */
export function ReglasIntervaloPanel() {
  const [reglas, setReglas] = useState<EmpresaReservasIntervaloRegla[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listReglasIntervalo();
    if (res.ok) setReglas(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h4 className="text-sm font-semibold">Reglas de intervalo</h4>
        <p className="text-xs text-muted-foreground">
          Limita cuántas reservas o cuántas personas pueden entrar en una franja
          horaria (por ejemplo, los viernes entre 22:00 y 23:00 como máximo 20
          personas). La franja es inclusiva en ambos extremos.
        </p>
      </header>

      <SeccionMetrica
        metrica="max_reservas"
        reglas={reglas.filter((r) => r.metrica === "max_reservas")}
        onChange={cargar}
      />
      <SeccionMetrica
        metrica="max_personas"
        reglas={reglas.filter((r) => r.metrica === "max_personas")}
        onChange={cargar}
      />
    </div>
  );
}

function SeccionMetrica({
  metrica,
  reglas,
  onChange,
}: {
  metrica: MetricaIntervalo;
  reglas: EmpresaReservasIntervaloRegla[];
  onChange: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<EmpresaReservasIntervaloRegla | null>(null);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();

  function abrirNueva() {
    setEditando(null);
    setModalOpen(true);
  }
  function abrirEditar(r: EmpresaReservasIntervaloRegla) {
    setEditando(r);
    setModalOpen(true);
  }
  async function borrar(r: EmpresaReservasIntervaloRegla) {
    const ok = await confirmDelete({
      title: "Borrar esta regla",
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    const res = await deleteReglaIntervalo(r.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Regla borrada");
    onChange();
  }

  const unidad = METRICA_INTERVALO_UNIDADES[metrica];
  const titulo = METRICA_INTERVALO_LABELS[metrica];

  return (
    <section className="space-y-3">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {titulo}
      </h5>

      {reglas.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Sin reglas. Añade la primera para empezar a limitar.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {reglas.map((r) => (
            <li
              key={r.id}
              className="border rounded-md px-3 py-2 text-sm flex items-center justify-between gap-2"
            >
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <strong>{r.valor}</strong>
                <span className="text-xs text-muted-foreground">{unidad}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-mono">
                  {r.horaInicio}–{r.horaFin}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs">
                  {r.turno === "AMBOS"
                    ? "Comida y cena"
                    : r.turno === "COMIDA"
                      ? "Comida"
                      : "Cena"}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <VigenciaBadge value={reglaToVigencia(r)} />
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => abrirEditar(r)}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => borrar(r)}
                  title="Borrar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div>
        <Button size="sm" variant="outline" onClick={abrirNueva}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva regla
        </Button>
      </div>

      <ReglaIntervaloModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        metrica={metrica}
        regla={editando}
        onSaved={onChange}
      />
      {confirmDeleteDialog}
    </section>
  );
}
