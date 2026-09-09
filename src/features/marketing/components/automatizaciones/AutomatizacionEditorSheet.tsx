"use client";

/**
 * El editor. Una automatización se lee de arriba abajo como una frase:
 * primero CUÁNDO, después QUÉ pasa, en orden.
 *
 * No hay lienzo, ni flechas, ni ramas. Un encargado de sala tiene que poder
 * montar la suya en dos minutos sin que nadie le explique nada.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2, Clock, Mail, MessageCircle, Smartphone, Bell, Filter } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DISPARADORES,
  PASOS,
  CONDICIONES,
  VARIABLES,
  disparadorDef,
  type Automatizacion,
  type Disparador,
  type Paso,
  type TipoPaso,
} from "@/features/marketing/data/automatizaciones";
import { guardarAutomatizacionAction } from "@/features/marketing/actions/automatizaciones-actions";

const ICONO_PASO: Record<TipoPaso, React.ElementType> = {
  esperar: Clock,
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  aviso: Bell,
  solo_si: Filter,
};

function pasoVacio(tipo: TipoPaso): Paso {
  switch (tipo) {
    case "esperar":
      return { tipo: "esperar", cantidad: 1, unidad: "dias" };
    case "email":
      return { tipo: "email", asunto: "", texto: "" };
    case "whatsapp":
      return { tipo: "whatsapp", texto: "" };
    case "sms":
      return { tipo: "sms", texto: "" };
    case "aviso":
      return { tipo: "aviso", departamentoId: "", titulo: "", texto: "" };
    case "solo_si":
      return { tipo: "solo_si", condicion: "acepta_marketing" };
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automatizacion: Automatizacion | null;
  departamentos: { id: string; nombre: string }[];
  onGuardada: () => void;
}

export function AutomatizacionEditorSheet({ open, onOpenChange, automatizacion, departamentos, onGuardada }: Props) {
  const [nombre, setNombre] = useState("");
  const [disparador, setDisparador] = useState<Disparador>("visita_terminada");
  const [ajuste, setAjuste] = useState("");
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [guardando, setGuardando] = useState(false);

  const def = disparadorDef(disparador);

  useEffect(() => {
    if (!open) return;
    if (automatizacion) {
      setNombre(automatizacion.nombre);
      setDisparador(automatizacion.disparador);
      const campo = disparadorDef(automatizacion.disparador)?.ajuste?.campo;
      setAjuste(campo ? String(automatizacion.disparadorConfig[campo] ?? "") : "");
      setPasos(automatizacion.pasos);
    } else {
      setNombre("");
      setDisparador("visita_terminada");
      setAjuste("");
      setPasos([]);
    }
  }, [open, automatizacion]);

  function cambiarDisparador(valor: Disparador) {
    setDisparador(valor);
    const d = disparadorDef(valor);
    setAjuste(d?.ajuste ? String(d.ajuste.defecto) : "");
  }

  function actualizar(indice: number, cambios: Partial<Paso>) {
    setPasos((prev) => prev.map((p, i) => (i === indice ? ({ ...p, ...cambios } as Paso) : p)));
  }

  function mover(indice: number, salto: number) {
    const destino = indice + salto;
    if (destino < 0 || destino >= pasos.length) return;
    setPasos((prev) => {
      const copia = [...prev];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  async function guardar() {
    if (!nombre.trim()) {
      toast.error("Ponle un nombre");
      return;
    }
    if (pasos.length === 0) {
      toast.error("Añade al menos un paso");
      return;
    }
    setGuardando(true);
    const config: Record<string, number> = {};
    if (def?.ajuste) config[def.ajuste.campo] = Number(ajuste || def.ajuste.defecto);

    const r = await guardarAutomatizacionAction({
      id: automatizacion?.id ?? null,
      nombre: nombre.trim(),
      disparador,
      disparadorConfig: config,
      pasos,
    });
    setGuardando(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    toast.success("Guardada");
    onGuardada();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="px-1">
          <SheetTitle>{automatizacion ? "Editar automatización" : "Nueva automatización"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-1 pb-28">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Gracias por venir"
            />
          </div>

          {/* ── Cuándo ─────────────────────────────────────── */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Cuando pase esto…</p>
            <Select value={disparador} onValueChange={(v) => cambiarDisparador(v as Disparador)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISPARADORES.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {def && <p className="text-xs text-muted-foreground">{def.ayuda}</p>}
            {def?.ajuste && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{def.ajuste.label}</span>
                <Input
                  type="number"
                  className="h-9 w-24"
                  min={def.ajuste.min}
                  max={def.ajuste.max}
                  value={ajuste}
                  onChange={(e) => setAjuste(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">{def.ajuste.sufijo}</span>
              </div>
            )}
          </div>

          {/* ── Qué se hace ────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Haz esto, en orden</p>

            {pasos.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Todavía no hace nada. Añade el primer paso abajo.
              </p>
            )}

            {pasos.map((paso, i) => {
              const Icono = ICONO_PASO[paso.tipo];
              const meta = PASOS.find((p) => p.value === paso.tipo);
              return (
                <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icono className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium flex-1">{meta?.label}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mover(i, -1)} aria-label="Subir">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mover(i, 1)} aria-label="Bajar">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setPasos((prev) => prev.filter((_, x) => x !== i))}
                      aria-label="Quitar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {paso.tipo === "esperar" && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        className="h-9 w-24"
                        value={paso.cantidad}
                        onChange={(e) => actualizar(i, { cantidad: Number(e.target.value) || 1 })}
                      />
                      <Select value={paso.unidad} onValueChange={(v) => actualizar(i, { unidad: v as "minutos" | "horas" | "dias" })}>
                        <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minutos">Minutos</SelectItem>
                          <SelectItem value="horas">Horas</SelectItem>
                          <SelectItem value="dias">Días</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {paso.tipo === "email" && (
                    <>
                      <Input
                        placeholder="Asunto"
                        value={paso.asunto}
                        onChange={(e) => actualizar(i, { asunto: e.target.value })}
                      />
                      <Textarea
                        rows={6}
                        placeholder="Hola {nombre}, gracias por venir…"
                        value={paso.texto}
                        onChange={(e) => actualizar(i, { texto: e.target.value })}
                      />
                      <Variables />
                    </>
                  )}

                  {(paso.tipo === "whatsapp" || paso.tipo === "sms") && (
                    <>
                      <Textarea
                        rows={3}
                        placeholder="Hola {nombre}…"
                        value={paso.texto}
                        onChange={(e) => actualizar(i, { texto: e.target.value })}
                      />
                      {paso.tipo === "whatsapp" && (
                        <Input
                          placeholder="Plantilla aprobada en WhatsApp (si la hay)"
                          value={paso.plantilla ?? ""}
                          onChange={(e) => actualizar(i, { plantilla: e.target.value })}
                        />
                      )}
                      <Variables />
                    </>
                  )}

                  {paso.tipo === "aviso" && (
                    <>
                      <Select
                        value={paso.departamentoId || undefined}
                        onValueChange={(v) => actualizar(i, { departamentoId: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="¿A qué departamento?" /></SelectTrigger>
                        <SelectContent>
                          {departamentos.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Título del aviso"
                        value={paso.titulo}
                        onChange={(e) => actualizar(i, { titulo: e.target.value })}
                      />
                      <Textarea
                        rows={3}
                        placeholder="Qué tiene que saber el equipo"
                        value={paso.texto}
                        onChange={(e) => actualizar(i, { texto: e.target.value })}
                      />
                    </>
                  )}

                  {paso.tipo === "solo_si" && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={paso.condicion}
                        onValueChange={(v) => actualizar(i, { condicion: v as typeof paso.condicion })}
                      >
                        <SelectTrigger className="h-9 flex-1 min-w-[240px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONDICIONES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {paso.condicion === "visitas_min" && (
                        <Input
                          type="number"
                          min={1}
                          className="h-9 w-24"
                          value={paso.valor ?? 2}
                          onChange={(e) => actualizar(i, { valor: Number(e.target.value) || 1 })}
                        />
                      )}
                      <p className="w-full text-xs text-muted-foreground">
                        Si no se cumple, la automatización para aquí y no manda nada más.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            <Select value="" onValueChange={(v) => setPasos((prev) => [...prev, pasoVacio(v as TipoPaso)])}>
              <SelectTrigger className="h-10">
                <span className="inline-flex items-center gap-2 text-sm">
                  <Plus className="h-4 w-4" /> Añadir paso
                </span>
              </SelectTrigger>
              <SelectContent>
                {PASOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="font-medium">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.ayuda}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button size="lg" onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Los huecos que se pueden escribir en el texto. Se ven, no hay que recordarlos. */
function Variables() {
  return (
    <p className="text-xs text-muted-foreground">
      Puedes escribir: {VARIABLES.map((v) => v.clave).join(" · ")}
    </p>
  );
}
