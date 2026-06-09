"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, MessageCircle, Smartphone, Eye, Send, Calendar, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SubmoduleToolbar, coincideBusquedaUniversal, type ToolbarColumna, type ToolbarColumnaVisible } from "@/shared/components/SubmoduleToolbar";
import { ResizableColumnsProvider } from "@/shared/components/ResizableColumns";
import { TableColumnHeader } from "@/shared/components/TableColumnHeader";
import { toast } from "sonner";
import { ESTADOS_CAMPANA, type CanalCampana, type EstadoCampana, type Campana } from "@/features/marketing/data/campanas";
import { crearCampanaEmailVacia, crearCampanaWhatsAppVacia, crearCampanaSmsVacia } from "@/features/marketing/data/campanas";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { listarCampanasConAtribucionAction, type CampanaAtribucionRow } from "@/features/marketing/actions/atribucion-actions";
import { CampanaEditorSheet } from "./CampanaEditorSheet";

interface Props {
  canal: Extract<CanalCampana, "email" | "whatsapp" | "sms">;
}

const CANAL_META: Record<Props["canal"], { label: string; icon: React.ElementType }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageCircle },
  sms: { label: "SMS", icon: Smartphone },
};

const COLUMNAS: ToolbarColumna[] = [
  { campo: "nombre", label: "Nombre", bloqueada: true },
  { campo: "enviados", label: "Enviados" },
  { campo: "abiertos", label: "Abiertos" },
  { campo: "tasaApertura", label: "Tasa apertura" },
  { campo: "reservasGeneradas", label: "Reservas generadas" },
  { campo: "estado", label: "Estado" },
  { campo: "ultimaEjecucion", label: "Última ejecución" },
];

function tiempoRelativo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const ahora = new Date();
  const diffMs = ahora.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `hace ${dias} d`;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function badgeEstado(estado: EstadoCampana) {
  const meta = ESTADOS_CAMPANA.find((e) => e.value === estado);
  const cls: Record<string, string> = {
    gray: "bg-muted text-muted-foreground border-border",
    blue: "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-600/30",
    emerald: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/30",
    amber: "bg-amber-600/15 text-amber-700 dark:text-amber-400 border-amber-600/30",
    red: "bg-red-600/15 text-red-700 dark:text-red-400 border-red-600/30",
    default: "bg-foreground/10 text-foreground border-border",
  };
  return <Badge variant="outline" className={cls[meta?.color ?? "default"]}>{meta?.label ?? estado}</Badge>;
}

export function CampanasListadoView({ canal }: Props) {
  const { empresaActual } = useEmpresa();
  const meta = CANAL_META[canal];
  const Icon = meta.icon;

  const [rows, setRows] = useState<CampanaAtribucionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorCampana, setEditorCampana] = useState<Campana | null>(null);
  const [columnasVisibles, setColumnasVisibles] = useState<ToolbarColumnaVisible>({
    nombre: true, enviados: true, abiertos: true, tasaApertura: true, reservasGeneradas: true, estado: true, ultimaEjecucion: true,
  });
  const [columnasOrden, setColumnasOrden] = useState<string[]>(COLUMNAS.map((c) => c.campo));

  async function refrescar() {
    setLoading(true);
    const r = await listarCampanasConAtribucionAction(canal);
    if (r.ok) setRows(r.data);
    else toast.error(r.error ?? "Error al cargar campañas");
    setLoading(false);
  }

  useEffect(() => { refrescar(); }, [canal]);

  const filtrados = useMemo(() => {
    if (!busqueda) return rows;
    return rows.filter((r) => coincideBusquedaUniversal(r, busqueda));
  }, [rows, busqueda]);

  const ordenVisible = columnasOrden.filter((c) => columnasVisibles[c] ?? true);

  function onCrearNueva() {
    const vacia =
      canal === "email" ? crearCampanaEmailVacia(empresaActual.id) :
      canal === "whatsapp" ? crearCampanaWhatsAppVacia(empresaActual.id) :
      crearCampanaSmsVacia(empresaActual.id);
    setEditorCampana(vacia);
    setEditorOpen(true);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/marketing/campanas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver a Campañas
        </Link>
        <div className="h-5 w-px bg-border" />
        <div className="inline-flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{meta.label}</span>
        </div>
      </div>

      <SubmoduleToolbar
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda={`Buscar campañas de ${meta.label.toLowerCase()}...`}
        onNuevo={onCrearNueva}
        textoNuevo="Nueva campaña"
        columnas={COLUMNAS}
        columnasVisibles={columnasVisibles}
        onColumnasVisiblesChange={setColumnasVisibles}
        columnasOrden={columnasOrden}
        onColumnasOrdenChange={setColumnasOrden}
      />

      <ResizableColumnsProvider storageKey={`marketing-campanas-${canal}`}>
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                {ordenVisible.includes("nombre") && (
                  <th className="px-3 py-2"><TableColumnHeader label="Nombre" /></th>
                )}
                {ordenVisible.includes("enviados") && (
                  <th className="px-3 py-2 w-24"><TableColumnHeader label="Enviados" /></th>
                )}
                {ordenVisible.includes("abiertos") && (
                  <th className="px-3 py-2 w-24"><TableColumnHeader label="Abiertos" /></th>
                )}
                {ordenVisible.includes("tasaApertura") && (
                  <th className="px-3 py-2 w-28"><TableColumnHeader label="Tasa apertura" /></th>
                )}
                {ordenVisible.includes("reservasGeneradas") && (
                  <th className="px-3 py-2 w-36"><TableColumnHeader label="Reservas generadas" /></th>
                )}
                {ordenVisible.includes("estado") && (
                  <th className="px-3 py-2 w-28"><TableColumnHeader label="Estado" /></th>
                )}
                {ordenVisible.includes("ultimaEjecucion") && (
                  <th className="px-3 py-2 w-36"><TableColumnHeader label="Última ejecución" /></th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={ordenVisible.length} className="text-center text-muted-foreground py-8">Cargando...</td></tr>
              )}
              {!loading && filtrados.length === 0 && (
                <tr>
                  <td colSpan={ordenVisible.length} className="text-center text-muted-foreground py-10">
                    <Send className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <div>Sin campañas de {meta.label.toLowerCase()} todavía.</div>
                    <div className="text-xs">Pulsa &quot;+ Nueva campaña&quot; para crear la primera.</div>
                  </td>
                </tr>
              )}
              {!loading && filtrados.map((r) => {
                const tasa = r.enviados > 0 ? Math.round((r.abiertos / r.enviados) * 100) : null;
                return (
                  <tr key={r.campanaId} className="border-b last:border-b-0 hover:bg-muted/20">
                    {ordenVisible.includes("nombre") && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{r.nombre || "(sin nombre)"}</span>
                          {r.origen && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-sky-600/10 text-sky-700 dark:text-sky-400 border border-sky-600/20 rounded px-1.5 py-px">
                              <Link2 className="h-2.5 w-2.5" />
                              {r.origen}
                            </span>
                          )}
                          {r.demoMode && (
                            <span className="text-[10px] uppercase font-semibold text-amber-600 dark:text-amber-400">demo</span>
                          )}
                        </div>
                      </td>
                    )}
                    {ordenVisible.includes("enviados") && (
                      <td className="px-3 py-2 tabular-nums">{r.enviados.toLocaleString("es-ES")}</td>
                    )}
                    {ordenVisible.includes("abiertos") && (
                      <td className="px-3 py-2 tabular-nums">{r.abiertos.toLocaleString("es-ES")}</td>
                    )}
                    {ordenVisible.includes("tasaApertura") && (
                      <td className="px-3 py-2 tabular-nums">{tasa === null ? "—" : `${tasa}%`}</td>
                    )}
                    {ordenVisible.includes("reservasGeneradas") && (
                      <td className="px-3 py-2 tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {r.reservasGeneradas.toLocaleString("es-ES")}
                      </td>
                    )}
                    {ordenVisible.includes("estado") && (
                      <td className="px-3 py-2">{badgeEstado(r.estado)}</td>
                    )}
                    {ordenVisible.includes("ultimaEjecucion") && (
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {tiempoRelativo(r.ultimaEjecucion)}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ResizableColumnsProvider>

      {editorCampana && (
        <CampanaEditorSheet
          open={editorOpen}
          onOpenChange={(o) => {
            setEditorOpen(o);
            if (!o) setEditorCampana(null);
          }}
          campana={editorCampana}
          onGuardada={() => {
            setEditorOpen(false);
            setEditorCampana(null);
            refrescar();
          }}
        />
      )}
    </div>
  );
}

// Eye icon utilitario reexport para evitar tree-shake warnings
export { Eye };
