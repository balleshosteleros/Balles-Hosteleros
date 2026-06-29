"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Mail,
  MapPin,
  Loader2,
  Trash2,
  CheckCircle2,
  MessageCircle,
  Clock,
  Car,
} from "lucide-react";
import { FASES_INSPECTOR_CONFIG } from "../data";
import type { InspectorDetalle } from "../types";
import { eliminarInspector, getInspectorDetalle } from "../actions";
import { llamarDesdeApp } from "@/features/google-workspace/components/TelefonoDrawer";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { formatFechaEnZona } from "@/features/empresa/lib/zona-horaria";

function telefonoParaWhatsapp(input: string | null | undefined): string {
  if (!input) return "";
  const limpio = input.replace(/[^\d]/g, "");
  if (limpio.length === 9 && /^[679]/.test(limpio)) return "34" + limpio;
  return limpio;
}

interface Props {
  inspectorId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function InspectorDetailDialog({
  inspectorId,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const { empresaActual } = useEmpresa();
  const [data, setData] = useState<InspectorDetalle | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { confirm: confirmDelete, dialog: confirmDeleteDialog } =
    useConfirmDelete();

  useEffect(() => {
    if (!open || !inspectorId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getInspectorDetalle(inspectorId).then((res) => {
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [inspectorId, open]);

  async function handleDelete() {
    if (!inspectorId) return;
    const ok = await confirmDelete({
      title: "Eliminar inspector",
      description:
        "¿Eliminar este inspector? Sus inspecciones realizadas se conservan.",
      confirmLabel: "Eliminar",
    });
    if (!ok) return;
    setDeleting(true);
    const res = await eliminarInspector(inspectorId);
    setDeleting(false);
    if (res.ok) {
      onOpenChange(false);
      onChanged?.();
    } else {
      alert(res.error);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {loading || !data ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-xl">
                    {data.nombre} {data.apellidos ?? ""}
                  </DialogTitle>
                  <DialogDescription>
                    Inspector externo #{data.numero_secuencial ?? "—"}
                  </DialogDescription>
                </div>
                <Badge
                  variant="outline"
                  className={FASES_INSPECTOR_CONFIG[data.fase].color}
                >
                  {FASES_INSPECTOR_CONFIG[data.fase].label}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {data.telefono && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => llamarDesdeApp(data.telefono!)}
                      title="Llamar desde el software"
                      className="text-muted-foreground hover:text-sky-600 transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => llamarDesdeApp(data.telefono!)}
                      className="hover:underline text-left"
                    >
                      {data.telefono}
                    </button>
                    <a
                      href={`https://wa.me/${telefonoParaWhatsapp(data.telefono)}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir WhatsApp"
                      className="text-emerald-600 hover:text-emerald-700 transition-colors"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
                {data.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={`mailto:${data.email}`}
                      className="hover:underline"
                    >
                      {data.email}
                    </a>
                  </div>
                )}
                {data.ciudad && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {[data.ciudad, data.provincia].filter(Boolean).join(", ")}
                  </div>
                )}
                {data.disponibilidad?.horario && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    {data.disponibilidad.horario}
                  </div>
                )}
                {typeof data.disponibilidad?.vehiculo_propio === "boolean" && (
                  <div className="flex items-center gap-2">
                    <Car className="h-3.5 w-3.5 text-muted-foreground" />
                    Vehículo propio:{" "}
                    <span className="font-medium">
                      {data.disponibilidad.vehiculo_propio ? "Sí" : "No"}
                    </span>
                  </div>
                )}
              </div>

              {data.notas && (
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {data.notas}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 rounded-md border p-3 text-center">
                <Stat
                  label="Inspecciones"
                  value={String(data.num_inspecciones)}
                />
                <Stat
                  label="Nota media"
                  value={data.nota_media != null ? data.nota_media.toFixed(2) : "—"}
                />
                <Stat
                  label="Origen"
                  value={
                    data.origen === "formulario_publico"
                      ? "Web"
                      : data.origen === "alta_manual"
                        ? "Manual"
                        : "Referido"
                  }
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Histórico de inspecciones
                </h3>
                {data.historial.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no ha realizado inspecciones.
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40">
                        <tr className="text-left">
                          <th className="px-2 py-1.5">Nº</th>
                          <th className="px-2 py-1.5">Local</th>
                          <th className="px-2 py-1.5">Fecha</th>
                          <th className="px-2 py-1.5">Nota</th>
                          <th className="px-2 py-1.5">Verificada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.historial.map((h) => (
                          <tr key={h.envio_id} className="border-t">
                            <td className="px-2 py-1.5 font-mono">
                              #{h.numero_secuencial ?? "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              {h.local_nombre ?? "—"}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {h.fecha_inspeccion
                                ? formatFechaEnZona(h.fecha_inspeccion, empresaActual.zonaHoraria)
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5 font-semibold">
                              {h.nota_final != null
                                ? h.nota_final.toFixed(2)
                                : "—"}
                            </td>
                            <td className="px-2 py-1.5">
                              {h.verificado_at ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <span className="text-amber-600 text-[10px]">
                                  Pendiente
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t flex justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  Eliminar
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    {confirmDeleteDialog}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
