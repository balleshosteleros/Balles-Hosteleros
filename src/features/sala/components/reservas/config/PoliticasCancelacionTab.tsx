"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  CANCELACION_HORAS_MAX,
  CANCELACION_HORAS_MIN,
  CANCELACION_IMPORTE_DEFAULT,
  CANCELACION_IMPORTE_MAX,
  CANCELACION_IMPORTE_MIN,
  CANCELACION_TEXTO_FIJO,
  type EmpresaReservasConfig,
  type PoliticaCancelacion,
} from "@/features/sala/data/reservas";
import {
  getReservasConfig,
  upsertReservasConfig,
} from "@/features/sala/actions/reservas-config-actions";
import {
  listPoliticasCancelacion,
  createPoliticaCancelacion,
  updatePoliticaCancelacion,
  deletePoliticaCancelacion,
} from "@/features/sala/actions/politicas-cancelacion-actions";

const HORAS_OPCIONES = [1, 2, 3, 4, 6, 8, 12, 24, 48, 72] as const;

export function PoliticasCancelacionTab() {
  // --- Configuración GLOBAL de política de cancelación (1 por empresa) ---
  const [config, setConfig] = useState<EmpresaReservasConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [importeStr, setImporteStr] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargarConfig = useCallback(async () => {
    const c = await getReservasConfig();
    if (c.ok && c.data) {
      setConfig(c.data);
      setImporteStr(c.data.cancelacionImporteEur.toFixed(2));
    }
    setConfigLoading(false);
  }, []);

  useEffect(() => {
    cargarConfig();
  }, [cargarConfig]);

  function patchConfig(parche: Partial<EmpresaReservasConfig>) {
    setConfig((prev) => (prev ? ({ ...prev, ...parche } as EmpresaReservasConfig) : prev));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await upsertReservasConfig(parche);
      if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
    }, 500);
  }

  function commitImporte(raw: string) {
    // Acepta coma o punto, máximo 2 decimales, mínimo 1.00.
    const norm = raw.replace(",", ".").trim();
    const n = Number(norm);
    if (!Number.isFinite(n) || n < CANCELACION_IMPORTE_MIN) {
      toast.error(`El importe mínimo es ${CANCELACION_IMPORTE_MIN.toFixed(2)} €`);
      const fallback = config?.cancelacionImporteEur ?? CANCELACION_IMPORTE_DEFAULT;
      setImporteStr(fallback.toFixed(2));
      return;
    }
    if (n > CANCELACION_IMPORTE_MAX) {
      toast.error(`El importe máximo es ${CANCELACION_IMPORTE_MAX.toFixed(2)} €`);
      setImporteStr(CANCELACION_IMPORTE_MAX.toFixed(2));
      patchConfig({ cancelacionImporteEur: CANCELACION_IMPORTE_MAX });
      return;
    }
    const redondeado = Math.round(n * 100) / 100;
    setImporteStr(redondeado.toFixed(2));
    if (redondeado !== config?.cancelacionImporteEur) {
      patchConfig({ cancelacionImporteEur: redondeado });
    }
  }

  // --- Lista (legacy) de políticas custom por empresa ---
  const [politicas, setPoliticas] = useState<PoliticaCancelacion[]>([]);
  const [politicasLoading, setPoliticasLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    horasAntes: "",
    penalizacionPct: "",
  });

  const loadPoliticas = useCallback(async () => {
    setPoliticasLoading(true);
    const res = await listPoliticasCancelacion();
    if (res.ok) setPoliticas(res.data);
    setPoliticasLoading(false);
  }, []);

  useEffect(() => { loadPoliticas(); }, [loadPoliticas]);

  async function handleCreate() {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setCreando(true);
    const res = await createPoliticaCancelacion({
      nombre: form.nombre,
      descripcion: form.descripcion.trim() || null,
      horasAntes: form.horasAntes ? Number(form.horasAntes) : null,
      penalizacionPct: form.penalizacionPct ? Number(form.penalizacionPct) : null,
      orden: politicas.length + 1,
    });
    setCreando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo crear");
      return;
    }
    toast.success("Política añadida");
    setForm({ nombre: "", descripcion: "", horasAntes: "", penalizacionPct: "" });
    loadPoliticas();
  }

  async function patchPolitica(id: string, p: Parameters<typeof updatePoliticaCancelacion>[1]) {
    const res = await updatePoliticaCancelacion(id, p);
    if (!res.ok) toast.error(res.error ?? "No se pudo guardar");
    else loadPoliticas();
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Borrar la política "${nombre}"?`)) return;
    const res = await deletePoliticaCancelacion(id);
    if (!res.ok) toast.error(res.error ?? "No se pudo borrar");
    else {
      toast.success("Política borrada");
      loadPoliticas();
    }
  }

  return (
    <div className="space-y-6">
      {/* === Política de cancelación (global, texto fijo) === */}
      <section className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold mb-1">Política de cancelación</h4>
          <p className="text-xs text-muted-foreground">
            Condiciones que se aplican cuando una reserva se marca con &quot;Política de
            cancelación&quot;. El texto que ve el cliente es el mismo para todas las
            empresas; solo el importe y las horas son editables.
          </p>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-foreground/90">
          {CANCELACION_TEXTO_FIJO}
        </div>

        {configLoading || !config ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 items-start">
            <div className="space-y-1.5">
              <Label className="text-xs">Tiempo mínimo de cancelación</Label>
              <Select
                value={String(config.cancelacionHorasAntes)}
                onValueChange={(v) => {
                  const n = Number(v);
                  if (Number.isFinite(n)) patchConfig({ cancelacionHorasAntes: n });
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORAS_OPCIONES.map((h) => (
                    <SelectItem key={h} value={String(h)} className="text-xs">
                      {h} {h === 1 ? "hora" : "horas"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground md:pt-7">
              Tiempo mínimo en el que el cliente puede cancelar sin que se le aplique
              política de cancelación. Solo horas completas ({CANCELACION_HORAS_MIN}–
              {CANCELACION_HORAS_MAX} h).
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">Importe a cobrar (€)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="Euros"
                value={importeStr}
                onChange={(e) => {
                  // Permite escribir libremente; valida al perder foco.
                  const v = e.target.value;
                  if (/^[0-9]*[.,]?[0-9]{0,2}$/.test(v) || v === "") setImporteStr(v);
                }}
                onBlur={(e) => commitImporte(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground md:pt-7">
              Se efectuará un cargo al cliente por esta cantidad si no se presenta o
              cancela a menos de ({config.cancelacionHorasAntes}) horas. Mínimo{" "}
              {CANCELACION_IMPORTE_MIN.toFixed(2)} €, máximo 2 decimales.
            </p>
          </div>
        )}
      </section>

      <Separator />

      {/* === Mensaje al pedir tarjeta === */}
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Mensaje al pedir tarjeta</h4>
        {configLoading || !config ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="text-xs text-foreground/90 leading-relaxed max-w-[70%]">
                Personalizar mensaje por defecto al pedir tarjeta de política de
                cancelación
              </div>
              <SiNoRadio
                value={config.cancelacionPersonalizarMensaje}
                onChange={(v) =>
                  patchConfig({
                    cancelacionPersonalizarMensaje: v,
                    // Si lo apaga, no borra el texto: lo conserva por si lo reactivan.
                  })
                }
              />
            </div>
            {config.cancelacionPersonalizarMensaje && (
              <Textarea
                placeholder="Texto que se añadirá al correo cuando la reserva tenga política de cancelación."
                value={config.cancelacionMensajePersonalizado ?? ""}
                onChange={(e) => patchConfig({ cancelacionMensajePersonalizado: e.target.value })}
                className="text-xs min-h-[80px]"
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              El otro caso (mensaje al pedir tarjeta cuando se vende un producto
              directamente) se configura en el apartado de Ticket.
            </p>
          </div>
        )}
      </section>

      <Separator />

      {/* === Políticas custom (legacy, opcional) === */}
      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold mb-1">Políticas custom (avanzado)</h4>
          <p className="text-xs text-muted-foreground">
            Reglas adicionales que se pueden asignar manualmente a una reserva
            cuando se necesita algo distinto a la política general (eventos
            especiales, grupos, etc.).
          </p>
        </div>

        <div className="border rounded-md divide-y">
          <div className="grid grid-cols-[1fr_2fr_90px_90px_90px_40px] gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30">
            <span>Nombre</span>
            <span>Descripción</span>
            <span className="text-right">Horas antes</span>
            <span className="text-right">% Penaliz.</span>
            <span className="text-center">Activa</span>
            <span></span>
          </div>
          {politicasLoading ? (
            <div className="p-4 text-center text-xs text-muted-foreground">Cargando…</div>
          ) : politicas.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Sin políticas custom. Añade una abajo si la necesitas.
            </div>
          ) : (
            politicas.map((p) => (
              <div
                key={p.id}
                className="grid grid-cols-[1fr_2fr_90px_90px_90px_40px] gap-2 px-3 py-2 items-center"
              >
                <Input
                  defaultValue={p.nombre}
                  className="h-8 text-xs"
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    e.target.value !== p.nombre &&
                    patchPolitica(p.id, { nombre: e.target.value })
                  }
                />
                <Input
                  defaultValue={p.descripcion ?? ""}
                  className="h-8 text-xs"
                  onBlur={(e) =>
                    e.target.value !== (p.descripcion ?? "") &&
                    patchPolitica(p.id, { descripcion: e.target.value || null })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  defaultValue={p.horasAntes ?? ""}
                  className="h-8 text-xs text-right"
                  placeholder="—"
                  onBlur={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== p.horasAntes) patchPolitica(p.id, { horasAntes: v });
                  }}
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  defaultValue={p.penalizacionPct ?? ""}
                  className="h-8 text-xs text-right"
                  placeholder="—"
                  onBlur={(e) => {
                    const v = e.target.value ? Number(e.target.value) : null;
                    if (v !== p.penalizacionPct) patchPolitica(p.id, { penalizacionPct: v });
                  }}
                />
                <div className="flex justify-center">
                  <Switch
                    checked={p.activa}
                    onCheckedChange={(v) => patchPolitica(p.id, { activa: v })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(p.id, p.nombre)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="border rounded-md p-3 bg-muted/30 space-y-2">
          <div className="text-xs font-medium">Añadir política custom</div>
          <div className="grid grid-cols-[1fr_90px_90px_120px] gap-2">
            <Input
              placeholder="Nombre (p.ej. 'Grupo 12 pax')"
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              className="h-8 text-xs"
            />
            <Input
              type="number"
              min={0}
              placeholder="Horas"
              value={form.horasAntes}
              onChange={(e) => setForm((p) => ({ ...p, horasAntes: e.target.value }))}
              className="h-8 text-xs text-right"
            />
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="% Penaliz."
              value={form.penalizacionPct}
              onChange={(e) => setForm((p) => ({ ...p, penalizacionPct: e.target.value }))}
              className="h-8 text-xs text-right"
            />
            <Button size="sm" onClick={handleCreate} disabled={creando} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
            </Button>
          </div>
          <Textarea
            placeholder="Descripción (opcional) — qué se cobra y cuándo."
            value={form.descripcion}
            onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
            className="text-xs min-h-[60px]"
          />
        </div>
      </section>
    </div>
  );
}

function SiNoRadio({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-4 shrink-0">
      <RadioPill label="No" active={!value} onClick={() => onChange(false)} />
      <RadioPill label="Sí" active={value} onClick={() => onChange(true)} />
    </div>
  );
}

function RadioPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs"
    >
      <span
        className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${active ? "border-primary" : "border-muted-foreground/40"}`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      {label}
    </button>
  );
}
