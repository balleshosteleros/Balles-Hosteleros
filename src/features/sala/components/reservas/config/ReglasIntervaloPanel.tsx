"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reglaToVigencia, vigenciaToCampos } from "@/features/sala/reglas/data/reglas";
import {
  type EmpresaReservasIntervaloRegla,
  type IntervaloReglaInput,
  type MetricaIntervalo,
  METRICA_INTERVALO_LABELS,
  METRICA_INTERVALO_UNIDADES,
} from "@/features/sala/reglas/data/reglas-intervalo";
import {
  createReglaIntervalo,
  deleteReglaIntervalo,
  listReglasIntervalo,
  updateReglaIntervalo,
} from "@/features/sala/reglas/actions/reglas-intervalo-actions";
import {
  esFilaNueva,
  useListaPendiente,
} from "@/features/sala/reglas/hooks/useListaPendiente";
import type { PanelPendienteHandle } from "./LimitesReglas";
import { VigenciaBadge } from "@/features/sala/reglas/components/VigenciaBadge";
import { ReglaIntervaloModal } from "./ReglaIntervaloModal";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";

/**
 * Panel de reglas de intervalo: límites de "máx reservas por franja" y
 * "máx personas por franja", con periodicidad. Va dentro de la pestaña
 * "Configuración" de Reservas.
 */
interface ReglasIntervaloPanelProps {
  handleRef?: RefObject<PanelPendienteHandle | null>;
  onDirtyChange?: () => void;
}

export function ReglasIntervaloPanel({
  handleRef,
  onDirtyChange,
}: ReglasIntervaloPanelProps) {
  const [loading, setLoading] = useState(true);

  const lista = useListaPendiente<EmpresaReservasIntervaloRegla, IntervaloReglaInput>({
    idDe: (r) => r.id,
    aInput: (r) => ({
      metrica: r.metrica,
      valor: r.valor,
      horaInicio: r.horaInicio,
      horaFin: r.horaFin,
      turno: r.turno,
      vigencia: reglaToVigencia(r),
    }),
  });
  const { cargar: cargarLista, filas: reglas, cambios, hayCambios } = lista;

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listReglasIntervalo();
    if (res.ok) cargarLista(res.data);
    setLoading(false);
  }, [cargarLista]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    onDirtyChange?.();
  }, [hayCambios, onDirtyChange]);

  const guardar = useCallback(async (): Promise<boolean> => {
    for (const id of cambios.borrar) {
      const res = await deleteReglaIntervalo(id);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo borrar una regla de intervalo");
        return false;
      }
    }
    for (const { id, input } of cambios.editar) {
      const res = await updateReglaIntervalo(id, input);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo actualizar una regla de intervalo");
        return false;
      }
    }
    for (const input of cambios.crear) {
      const res = await createReglaIntervalo(input);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear una regla de intervalo");
        return false;
      }
    }
    await cargar();
    return true;
  }, [cambios, cargar]);

  useImperativeHandle(handleRef, () => ({ hayCambios, guardar }), [hayCambios, guardar]);

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
        lista={lista}
      />
      <SeccionMetrica
        metrica="max_personas"
        reglas={reglas.filter((r) => r.metrica === "max_personas")}
        lista={lista}
      />
    </div>
  );
}

function SeccionMetrica({
  metrica,
  reglas,
  lista,
}: {
  metrica: MetricaIntervalo;
  reglas: EmpresaReservasIntervaloRegla[];
  lista: ReturnType<
    typeof useListaPendiente<EmpresaReservasIntervaloRegla, IntervaloReglaInput>
  >;
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
      title: "Quitar esta regla",
      description: esFilaNueva(r.id)
        ? "Aún no se había guardado: desaparece sin más."
        : "Se borrará al guardar los cambios de la pestaña.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    lista.quitar(r.id);
  }

  function onModalGuardado(input: IntervaloReglaInput) {
    const campos = {
      metrica: input.metrica,
      valor: input.valor,
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      turno: input.turno,
      ...vigenciaToCampos(input.vigencia),
    };
    if (editando) {
      lista.reemplazar(editando.id, { ...editando, ...campos });
    } else {
      lista.anadir({
        id: lista.nuevoIdTemporal(),
        empresaId: "",
        prioridad: 0,
        nombre: null,
        activo: true,
        createdAt: "",
        updatedAt: "",
        ...campos,
      });
    }
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
              className={`border rounded-md px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                esFilaNueva(r.id) ? "border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : ""
              }`}
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
                {esFilaNueva(r.id) && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    Sin guardar
                  </span>
                )}
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
        onSaved={onModalGuardado}
      />
      {confirmDeleteDialog}
    </section>
  );
}
