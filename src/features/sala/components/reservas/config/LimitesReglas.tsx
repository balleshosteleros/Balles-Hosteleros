"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type EmpresaReservasRegla,
  type MetricaRegla,
  type ReglaInput,
  type TurnoRegla,
  reglaToVigencia,
  vigenciaToCampos,
} from "@/features/sala/reglas/data/reglas";
import { type EmpresaReservasConfig } from "@/features/sala/data/reservas";
import { getReservasConfig } from "@/features/sala/actions/reservas-config-actions";
import {
  createReglaReserva,
  deleteReglaReserva,
  listReglasReservas,
  updateReglaReserva,
} from "@/features/sala/reglas/actions/reglas-actions";
import {
  esFilaNueva,
  useListaPendiente,
} from "@/features/sala/reglas/hooks/useListaPendiente";
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

const DIAS_SEMANA = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"] as const;

/**
 * ¿El turno abre algún día de la semana? Se mira día a día, no solo el general:
 * un local que solo da comidas los viernes tiene el general cerrado y aun así
 * necesita poder configurar topes de aforo para la comida.
 *
 * Misma jerarquía que `horario-resolver`: el patrón semanal manda sobre el
 * general, y el día solo hereda el general cuando no dice nada.
 */
function turnoAbreAlgunDia(
  cfg: EmpresaReservasConfig,
  turno: "comida" | "cena",
): boolean {
  const genCerrado = turno === "comida" ? cfg.generalCerradoComida : cfg.generalCerradoCena;
  return DIAS_SEMANA.some((dia) => {
    const cerradoDia = cfg[`${dia}_cerrado_${turno}` as const];
    const inicioDia = cfg[`${dia}_inicio_${turno}` as const];
    const finDia = cfg[`${dia}_fin_${turno}` as const];
    if (cerradoDia === true) return false;
    if (inicioDia != null || finDia != null) return true;
    return !genCerrado;
  });
}

/** Lo que el panel expone a la pestaña para que el Guardar de arriba mande. */
export interface PanelPendienteHandle {
  hayCambios: boolean;
  /** Vuelca los cambios. Devuelve false si algo falló. */
  guardar: () => Promise<boolean>;
}

interface LimitesReglasProps {
  /** La pestaña lo usa para saber si hay cambios y para volcarlos. */
  handleRef?: RefObject<PanelPendienteHandle | null>;
  /** Avisa a la pestaña de que el "hay cambios" ha cambiado. */
  onDirtyChange?: () => void;
}

export function LimitesReglas({ handleRef, onDirtyChange }: LimitesReglasProps) {
  const [loading, setLoading] = useState(true);
  // Turnos que el local abre de verdad. Un turno cerrado no admite reservas, así
  // que ofrecer un tope de aforo para él confunde: se configura algo que nunca
  // se va a aplicar.
  const [turnosAbiertos, setTurnosAbiertos] = useState<TurnoRegla[]>(["COMIDA", "CENA", "AMBOS"]);

  const lista = useListaPendiente<EmpresaReservasRegla, ReglaInput>({
    idDe: (r) => r.id,
    aInput: (r) => ({
      metrica: r.metrica,
      valor: r.valor,
      turno: r.turno,
      vigencia: reglaToVigencia(r),
    }),
  });
  const { cargar: cargarLista, filas: reglas, cambios, hayCambios } = lista;

  const cargar = useCallback(async () => {
    setLoading(true);
    const [res, cfg] = await Promise.all([listReglasReservas(), getReservasConfig()]);
    if (res.ok) cargarLista(res.data);
    if (cfg.ok && cfg.data) {
      const comida = turnoAbreAlgunDia(cfg.data, "comida");
      const cena = turnoAbreAlgunDia(cfg.data, "cena");
      const abiertos: TurnoRegla[] = [];
      if (comida) abiertos.push("COMIDA");
      if (cena) abiertos.push("CENA");
      if (comida && cena) abiertos.push("AMBOS");
      // Si estuvieran los dos cerrados no dejamos el selector vacío.
      setTurnosAbiertos(abiertos.length > 0 ? abiertos : ["COMIDA", "CENA", "AMBOS"]);
    }
    setLoading(false);
  }, [cargarLista]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Se avisa a la pestaña en cuanto aparecen (o desaparecen) cambios, para que
  // active su botón Guardar.
  useEffect(() => {
    onDirtyChange?.();
  }, [hayCambios, onDirtyChange]);

  const guardar = useCallback(async (): Promise<boolean> => {
    // Borrados primero: si una regla se editó y luego se borró, no tiene sentido
    // gastar una escritura en actualizarla antes de eliminarla.
    for (const id of cambios.borrar) {
      const res = await deleteReglaReserva(id);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo borrar una regla de aforo");
        return false;
      }
    }
    for (const { id, input } of cambios.editar) {
      const res = await updateReglaReserva(id, input);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo actualizar una regla de aforo");
        return false;
      }
    }
    for (const input of cambios.crear) {
      const res = await createReglaReserva(input);
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo crear una regla de aforo");
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
      <SeccionMetrica
        metrica="cupo"
        titulo="Aforo total del turno"
        descripcion="Número máximo de personas que aceptas en total durante el turno (sumando todas las reservas). Al alcanzar el tope, el turno se cierra a nuevas reservas."
        unidad="personas"
        reglas={reglas.filter((r) => r.metrica === "cupo")}
        turnosAbiertos={turnosAbiertos}
        lista={lista}
      />
      <SeccionMetrica
        metrica="maxpax"
        titulo="Tamaño máximo por reserva"
        descripcion="Personas máximas en una sola reserva (una mesa o combinación de mesas). Si alguien pide más, debe gestionarse como reserva de Grupo."
        unidad="personas"
        reglas={reglas.filter((r) => r.metrica === "maxpax")}
        turnosAbiertos={turnosAbiertos}
        lista={lista}
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
  turnosAbiertos,
  lista,
}: {
  metrica: MetricaRegla;
  titulo: string;
  descripcion: string;
  unidad: string;
  reglas: EmpresaReservasRegla[];
  turnosAbiertos: TurnoRegla[];
  lista: ReturnType<typeof useListaPendiente<EmpresaReservasRegla, ReglaInput>>;
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
      title: "Quitar esta regla",
      description: esFilaNueva(r.id)
        ? "Aún no se había guardado: desaparece sin más."
        : "Se borrará al guardar los cambios de la pestaña.",
      confirmLabel: "Quitar",
    });
    if (!ok) return;
    lista.quitar(r.id);
  }

  /** Vuelca lo que devuelve el modal sobre la lista en memoria. */
  function onModalGuardado(input: ReglaInput) {
    const campos = {
      metrica: input.metrica,
      valor: input.valor,
      turno: input.turno,
      ...vigenciaToCampos(input.vigencia),
    };
    if (editando) {
      lista.reemplazar(editando.id, { ...editando, ...campos });
    } else {
      // Fila provisional: los campos que pone la base de datos (fechas, activo…)
      // se rellenan de verdad al recargar tras guardar.
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
              className={`border rounded-md px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                esFilaNueva(r.id) ? "border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-950/20" : ""
              }`}
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

      <ReglaModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        metrica={metrica}
        regla={editando}
        unidad={unidad}
        turnosAbiertos={turnosAbiertos}
        onSaved={onModalGuardado}
      />
      {confirmDeleteDialog}
    </section>
  );
}
