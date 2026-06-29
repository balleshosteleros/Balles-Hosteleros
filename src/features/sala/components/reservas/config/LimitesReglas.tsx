"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type EmpresaReservasRegla,
  type MetricaRegla,
} from "@/features/sala/reglas/data/reglas";
import {
  deleteReglaReserva,
  listReglasReservas,
} from "@/features/sala/reglas/actions/reglas-actions";
import { ReglaModal } from "@/features/sala/reglas/components/ReglaModal";
import { VigenciaBadge } from "@/features/sala/reglas/components/VigenciaBadge";
import { resolverValorEfectivo } from "@/features/sala/reglas/lib/resolver";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

function hoyEnZonaISO(tz: string): string {
  // Sin librerías: usamos Intl con la zona de la empresa.
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // "YYYY-MM-DD"
}

export function LimitesReglas() {
  const [reglas, setReglas] = useState<EmpresaReservasRegla[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listReglasReservas();
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
      <SeccionMetrica
        metrica="cupo"
        titulo="Aforo total del turno"
        descripcion="Número máximo de personas que aceptas en total durante el turno (sumando todas las reservas). Al alcanzar el tope, el turno se cierra a nuevas reservas."
        unidad="personas"
        reglas={reglas.filter((r) => r.metrica === "cupo")}
        onChange={cargar}
      />
      <SeccionMetrica
        metrica="maxpax"
        titulo="Tamaño máximo por reserva"
        descripcion="Personas máximas en una sola reserva (una mesa o combinación de mesas). Si alguien pide más, debe gestionarse como reserva de Grupo."
        unidad="personas"
        reglas={reglas.filter((r) => r.metrica === "maxpax")}
        onChange={cargar}
      />
    </div>
  );
}

function SeccionMetrica({
  metrica,
  titulo,
  descripcion,
  unidad,
  reglas,
  onChange,
}: {
  metrica: MetricaRegla;
  titulo: string;
  descripcion: string;
  unidad: string;
  reglas: EmpresaReservasRegla[];
  onChange: () => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<EmpresaReservasRegla | null>(null);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } = useConfirmDelete();
  const { empresaActual } = useEmpresa();

  const hoy = useMemo(() => hoyEnZonaISO(empresaActual.zonaHoraria), [empresaActual.zonaHoraria]);
  const valorHoyComida = resolverValorEfectivo(reglas, hoy, "COMIDA", metrica);
  const valorHoyCena = resolverValorEfectivo(reglas, hoy, "CENA", metrica);

  function abrirNueva() {
    setEditando(null);
    setModalOpen(true);
  }
  function abrirEditar(r: EmpresaReservasRegla) {
    setEditando(r);
    setModalOpen(true);
  }
  async function borrar(r: EmpresaReservasRegla) {
    const ok = await confirmDelete({
      title: "Borrar esta regla",
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Borrar",
    });
    if (!ok) return;
    const res = await deleteReglaReserva(r.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo borrar");
      return;
    }
    toast.success("Regla borrada");
    onChange();
  }

  return (
    <section className="space-y-3">
      <header className="space-y-1">
        <h4 className="text-sm font-semibold">{titulo}</h4>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </header>

      {/* Banner "Hoy aplica" */}
      <div className="rounded-md border bg-muted/40 px-3 py-2 flex items-center justify-between text-sm">
        <span className="text-xs text-muted-foreground">Hoy aplica</span>
        <div className="flex items-center gap-4">
          <span>
            <span className="text-muted-foreground">Comida: </span>
            <strong>{valorHoyComida ?? "—"}</strong>
          </span>
          <span>
            <span className="text-muted-foreground">Cena: </span>
            <strong>{valorHoyCena ?? "—"}</strong>
          </span>
        </div>
      </div>

      {/* Lista de reglas */}
      {reglas.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          Sin reglas. Añade la primera para fijar el valor.
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
                <span className="text-xs">
                  {r.turno === "AMBOS"
                    ? "Comida y cena"
                    : r.turno === "COMIDA"
                      ? "Comida"
                      : "Cena"}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <VigenciaBadge value={r} />
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

      <ReglaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        metrica={metrica}
        regla={editando}
        unidad={unidad}
        onSaved={onChange}
      />
      {confirmDeleteDialog}
    </section>
  );
}
