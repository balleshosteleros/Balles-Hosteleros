"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  CheckSquare2, Square, Plus, Trash2, ChevronLeft, ChevronRight, Link2, Sparkles,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  format, isToday, isSameDay, parseISO, addDays, addMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  listTareasMias, crearTareaManual,
  marcarTarea as toggleTareaHechaAction, // Usar marcarTarea que es la que existe
  deleteTarea as deleteTareaAction,
  listTareasSugeridas, completarTareaSugerida,
  type TareaRow,
} from "@/features/tareas/actions/tareas-actions";


// Tipo legacy mantenido por compatibilidad con otras importaciones.
export interface Tarea {
  id: string;
  titulo: string;
  fecha: string;
  hecha: boolean;
  prioridad: "alta" | "media" | "baja";
}

const PRIO_COLORS: Record<Tarea["prioridad"], string> = {
  alta: "bg-red-100 text-red-700 border-red-200",
  media: "bg-amber-100 text-amber-700 border-amber-200",
  baja: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const PRIO_LABEL: Record<Tarea["prioridad"], string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export function TareasDrawer({ children }: { children: ReactNode }) {
  const [tareas, setTareas] = useState<TareaRow[]>([]);
  const [tab, setTab] = useState<"hoy" | "semana" | "mes">("hoy");
  const [newTitulo, setNewTitulo] = useState("");
  const [newPrio, setNewPrio] = useState<Tarea["prioridad"]>("media");
  const [refDate, setRefDate] = useState(new Date());
  const [open, setOpen] = useState(false);

  const [sugeridas, setSugeridas] = useState<any[]>([]);

  const cargar = useCallback(async () => {
    const res = await listTareasMias();
    if (res.ok) setTareas(res.data);
  }, []);

  const cargarSugeridas = useCallback(async () => {
    const res = await listTareasSugeridas();
    if (res.ok) setSugeridas(res.data);
  }, []);

  useEffect(() => {
    if (open) {
      cargar();
      cargarSugeridas();
    }
  }, [open, cargar, cargarSugeridas]);


  const addTarea = async () => {
    const titulo = newTitulo.trim();
    if (!titulo) return;
    const fecha = format(tab === "hoy" ? new Date() : refDate, "yyyy-MM-dd");
    const res = await crearTareaManual({ titulo, fecha, prioridad: newPrio });
    if (!res.ok) { toast.error(res.error); return; }
    setNewTitulo("");
    await cargar();
  };

  const toggleHecha = async (id: string) => {
    const res = await toggleTareaHechaAction(id);
    if (!res.ok) { toast.error(res.error); return; }
    await cargar();
  };

  const deleteTarea = async (id: string) => {
    const res = await deleteTareaAction(id);
    if (!res.ok) { toast.error(res.error); return; }
    await cargar();
  };

  const handleCompletarSugerida = async (cronogramaId: string, titulo: string) => {
    const res = await completarTareaSugerida(cronogramaId, titulo);
    if (!res.ok) { toast.error(res.error as string); return; }
    toast.success("Tarea del cronograma registrada");
    await cargar();
  };


  const tareasForDay = (day: Date) =>
    tareas.filter((t) => isSameDay(parseISO(t.fecha), day));

  const tareasHoy = tareas.filter((t) => isToday(parseISO(t.fecha)));
  const pendientesHoy = tareasHoy.filter((t) => !t.hecha).length;

  const weekStart = startOfWeek(refDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  function TareaItem({ t, compact = false }: { t: TareaRow; compact?: boolean }) {
    const esReceta = t.tipo === "nueva_receta_fase";
    const icon = esReceta ? <Sparkles className="h-3 w-3 text-violet-600" /> : null;

    const contenido = (
      <>
        <button onClick={(e) => { e.stopPropagation(); toggleHecha(t.id); }} className="shrink-0">
          {t.hecha ? (
            <CheckSquare2 className={compact ? "h-4 w-4 text-violet-600" : "h-5 w-5 text-violet-600"} />
          ) : (
            <Square className={compact ? "h-4 w-4 text-muted-foreground" : "h-5 w-5 text-muted-foreground"} />
          )}
        </button>
        <span className={`flex-1 ${compact ? "text-xs" : "text-sm"} ${t.hecha ? "line-through opacity-50" : ""}`}>
          {icon && <span className="inline-flex items-center mr-1">{icon}</span>}
          {t.titulo}
          {t.link_url && <Link2 className="h-3 w-3 inline ml-1 text-muted-foreground" />}
        </span>
        <span className={`${compact ? "text-[9px]" : "text-[10px]"} border rounded px-1.5 py-0.5 font-semibold shrink-0 ${PRIO_COLORS[t.prioridad]}`}>
          {compact ? t.prioridad.charAt(0).toUpperCase() : PRIO_LABEL[t.prioridad]}
        </span>
        <Button
          variant="ghost" size="icon"
          className={`${compact ? "h-5 w-5" : "h-6 w-6"} shrink-0 hover:text-red-500`}
          onClick={(e) => { e.stopPropagation(); deleteTarea(t.id); }}
        >
          <Trash2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        </Button>
      </>
    );

    if (t.link_url) {
      return (
        <Link
          href={t.link_url}
          onClick={() => setOpen(false)}
          className={`${compact ? "py-2" : "py-3"} px-5 flex items-center gap-3 hover:bg-muted/30 transition-colors ${t.hecha ? "opacity-50" : ""}`}
        >
          {contenido}
        </Link>
      );
    }
    return (
      <div className={`${compact ? "py-2" : "py-3"} px-5 flex items-center gap-3 hover:bg-muted/20 transition-colors ${t.hecha ? "opacity-50" : ""}`}>
        {contenido}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="border-b px-5 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <CheckSquare2 className="h-4 w-4 text-violet-600" />
              Mis Tareas
            </SheetTitle>
            {pendientesHoy > 0 && (
              <Badge className="bg-violet-600 text-white text-[10px] h-5 px-2">
                {pendientesHoy} pendientes hoy
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b bg-muted/20 shrink-0">
          {(["hoy", "semana", "mes"] as const).map((t) => {
            const count =
              t === "hoy"
                ? pendientesHoy
                : t === "semana"
                  ? weekDays.reduce((s, d) => s + tareasForDay(d).filter((x) => !x.hecha).length, 0)
                  : monthDays.reduce((s, d) => s + tareasForDay(d).filter((x) => !x.hecha).length, 0);
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? "border-b-2 border-violet-600 text-violet-700 bg-violet-50/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "hoy" ? "Hoy" : t === "semana" ? "Semana" : "Mes"}
                {count > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-violet-600 text-white text-[9px] font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {tab === "hoy" && (
            <>
              <div className="px-5 py-3 border-b bg-muted/10 flex gap-2 shrink-0">
                <Input
                  value={newTitulo}
                  onChange={(e) => setNewTitulo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTarea()}
                  placeholder="Añadir tarea de hoy…"
                  className="h-8 text-sm flex-1"
                />
                <select
                  value={newPrio}
                  onChange={(e) => setNewPrio(e.target.value as Tarea["prioridad"])}
                  className="h-8 text-xs rounded-md border bg-background px-2 text-foreground"
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
                <Button
                  size="sm"
                  className="h-8 w-8 p-0 bg-violet-600 hover:bg-violet-700"
                  onClick={addTarea}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {tareasHoy.length === 0 && sugeridas.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
                  <CheckSquare2 className="h-10 w-10 opacity-20 mb-3" />
                  <p className="text-sm">Sin tareas para hoy</p>
                  <p className="text-xs mt-1 opacity-70">Añade una tarea o espera asignaciones de otros</p>
                </div>
              ) : (
                <div className="divide-y flex-1 overflow-y-auto">
                  {/* Tareas Sugeridas (Cronograma) */}
                  {sugeridas.length > 0 && (
                    <div className="bg-violet-50/30">
                      <div className="px-5 py-2 text-[10px] font-bold text-violet-600 uppercase tracking-tighter flex items-center gap-1.5 border-b border-violet-100">
                        <Sparkles className="h-3 w-3" />
                        Cronograma Operativo ({sugeridas[0].rol})
                      </div>
                      {sugeridas.map((s) => {
                        const yaHecha = tareasHoy.some(t => t.ref_tabla === 'cronogramas_operativos' && t.ref_id === s.id);
                        return (
                          <div key={s.id} className={`py-3 px-5 flex items-center gap-3 border-b border-violet-100/50 ${yaHecha ? "opacity-50" : ""}`}>
                            <button 
                              disabled={yaHecha}
                              onClick={() => handleCompletarSugerida(s.id, s.tarea)} 
                              className="shrink-0"
                            >
                              {yaHecha ? (
                                <CheckSquare2 className="h-5 w-5 text-violet-600" />
                              ) : (
                                <Square className="h-5 w-5 text-violet-400 hover:text-violet-600 transition-colors" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${yaHecha ? "line-through" : ""}`}>{s.tarea}</p>
                              <div className="flex gap-2 mt-0.5">
                                 <Badge variant="outline" className="text-[8px] h-3.5 px-1 py-0 uppercase border-violet-200 text-violet-600 bg-white">
                                   {s.frecuencia}
                                 </Badge>
                                 {s.formacion && (
                                   <span className="text-[9px] text-muted-foreground italic truncate">req: {s.formacion}</span>
                                 )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Tareas Manuales/Asignadas */}
                  {tareasHoy.length > 0 && (
                    <>
                      {sugeridas.length > 0 && (
                        <div className="px-5 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter bg-muted/5 border-b">
                          Otras Tareas
                        </div>
                      )}
                      {tareasHoy.map((t) => <TareaItem key={t.id} t={t} />)}
                    </>
                  )}
                </div>
              )}

            </>
          )}

          {tab === "semana" && (
            <>
              <div className="flex items-center justify-between px-5 py-2.5 border-b bg-muted/10 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefDate((d) => addDays(d, -7))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-semibold text-muted-foreground">
                  {format(weekStart, "d MMM", { locale: es })} – {format(weekEnd, "d MMM yyyy", { locale: es })}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefDate((d) => addDays(d, 7))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-5 py-3 border-b bg-muted/10 flex gap-2 shrink-0">
                <Input
                  value={newTitulo}
                  onChange={(e) => setNewTitulo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTarea()}
                  placeholder={`Tarea para ${format(refDate, "EEEE d", { locale: es })}…`}
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" className="h-8 w-8 p-0 bg-violet-600 hover:bg-violet-700" onClick={addTarea}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="divide-y flex-1 overflow-y-auto">
                {weekDays.map((day) => {
                  const dayTareas = tareasForDay(day);
                  const pendientes = dayTareas.filter((t) => !t.hecha).length;
                  const isSelected = isSameDay(day, refDate);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`px-5 py-3 cursor-pointer transition-colors ${
                        isToday(day) ? "bg-violet-50/60" : isSelected ? "bg-muted/30" : "hover:bg-muted/20"
                      }`}
                      onClick={() => setRefDate(day)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-semibold capitalize ${isToday(day) ? "text-violet-700" : "text-muted-foreground"}`}>
                          {format(day, "EEEE d", { locale: es })}
                          {isToday(day) && (
                            <span className="ml-1.5 text-[9px] bg-violet-600 text-white px-1 rounded-full">HOY</span>
                          )}
                        </span>
                        {pendientes > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{pendientes} pendientes</Badge>
                        )}
                      </div>
                      {dayTareas.length === 0 ? (
                        <p className="text-xs text-muted-foreground/40 italic">Sin tareas</p>
                      ) : (
                        <div className="space-y-0.5 -mx-5">
                          {dayTareas.map((t) => <TareaItem key={t.id} t={t} compact />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "mes" && (
            <>
              <div className="flex items-center justify-between px-5 py-2.5 border-b bg-muted/10 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefDate((d) => addMonths(d, -1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-semibold text-muted-foreground capitalize">
                  {format(refDate, "MMMM yyyy", { locale: es })}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRefDate((d) => addMonths(d, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="grid grid-cols-7 mb-1">
                  {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                    <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {(() => {
                  const firstDow = (monthStart.getDay() + 6) % 7;
                  const cells: (Date | null)[] = [
                    ...Array<null>(firstDow).fill(null),
                    ...monthDays,
                  ];
                  return (
                    <div className="grid grid-cols-7 gap-0.5">
                      {cells.map((day, i) => {
                        if (!day) return <div key={`blank-${i}`} />;
                        const dayTareas = tareasForDay(day);
                        const done = dayTareas.filter((t) => t.hecha).length;
                        const total = dayTareas.length;
                        const isSelected = isSameDay(day, refDate);
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => { setRefDate(day); setTab("semana"); }}
                            className={`rounded-lg p-1 text-center transition-colors hover:bg-muted/40 ${
                              isToday(day) ? "bg-violet-100 ring-1 ring-violet-400" : isSelected ? "bg-muted/40" : ""
                            }`}
                          >
                            <span className={`text-xs font-medium block ${isToday(day) ? "text-violet-700" : ""}`}>
                              {format(day, "d")}
                            </span>
                            {total > 0 && (
                              <span className={`mt-0.5 inline-block text-[9px] font-bold px-1 rounded-full ${
                                done === total ? "bg-emerald-200 text-emerald-800" : "bg-violet-200 text-violet-800"
                              }`}>
                                {done}/{total}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="border-t flex-1 overflow-y-auto">
                <div className="px-5 py-2 bg-muted/10 border-b">
                  <p className="text-xs font-semibold text-muted-foreground capitalize">
                    {format(refDate, "EEEE d MMMM", { locale: es })}
                  </p>
                </div>
                <div className="px-5 py-3 border-b flex gap-2">
                  <Input
                    value={newTitulo}
                    onChange={(e) => setNewTitulo(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTarea()}
                    placeholder="Añadir tarea…"
                    className="h-8 text-sm flex-1"
                  />
                  <Button size="sm" className="h-8 w-8 p-0 bg-violet-600 hover:bg-violet-700" onClick={addTarea}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {tareasForDay(refDate).length === 0 ? (
                  <p className="px-5 py-4 text-xs text-muted-foreground/50 italic">Sin tareas para este día</p>
                ) : (
                  <div className="divide-y">
                    {tareasForDay(refDate).map((t) => <TareaItem key={t.id} t={t} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
