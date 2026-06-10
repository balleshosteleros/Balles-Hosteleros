"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { DEPARTAMENTOS } from "@/features/rrhh/data/rrhh";
import { getEmpleadosActivos, type EmpleadoActivo } from "@/features/rrhh/actions/empleados-actions";
import {
  type Encuesta, type GrupoPreguntas, type PreguntaEncuesta, type OpcionRespuesta,
  type TipoPregunta, type EstadoEncuesta,
  crearEncuestaVacia,
  ESTADO_ENCUESTA_LABEL, ESTADO_ENCUESTA_COLOR,
  TIPO_PREGUNTA_LABEL, COLORES_OPCIONES,
} from "@/features/rrhh/data/encuestas";
import {
  listEncuestas, createEncuesta, saveEncuesta, deleteEncuesta,
} from "@/features/gerencia/actions/encuestas-actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import {
  Search, Plus, MoreHorizontal, ArrowLeft, Trash2, GripVertical, AlertCircle, BarChart3, Users, Settings2, ClipboardList,
} from "lucide-react";

function ListadoEncuestas({
  encuestas, empleados, onSelect, onCrear, onEliminar,
}: {
  encuestas: Encuesta[];
  empleados: EmpleadoActivo[];
  onSelect: (e: Encuesta) => void;
  onCrear: () => void;
  onEliminar: (id: string) => void;
}) {
  const [busq, setBusq] = useState("");
  const [filtro, setFiltro] = useState<"todos" | EstadoEncuesta>("todos");

  const filtered = useMemo(() => {
    let list = encuestas;
    if (filtro !== "todos") list = list.filter((e) => e.estado === filtro);
    if (busq.trim()) {
      const q = busq.toLowerCase();
      list = list.filter((e) => e.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [encuestas, filtro, busq]);

  const totalEmpleados = empleados.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="primary" size="sm" onClick={onCrear}><Plus className="h-4 w-4" />Nuevo</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar encuesta..." value={busq} onChange={(e) => setBusq(e.target.value)} className="pl-9" />
        </div>
        {(["todos", "activa", "borrador", "finalizada", "archivada"] as const).map((f) => (
          <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>
            {f === "todos" ? "Todos" : ESTADO_ENCUESTA_LABEL[f as EstadoEncuesta]}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Estado</TableHead>
                <TableHead>Encuesta</TableHead>
                <TableHead>Empleados</TableHead>
                <TableHead className="w-[180px]">Respuestas</TableHead>
                <TableHead className="w-[140px]"></TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No hay encuestas</TableCell></TableRow>
              )}
              {filtered.map((enc) => {
                const destTotal = enc.destinatarios.tipo === "todos" ? totalEmpleados : (enc.destinatarios.ids.length || totalEmpleados);
                const resp = enc.respuestas.length;
                const pct = destTotal > 0 ? Math.round((resp / destTotal) * 100) : 0;
                return (
                  <TableRow key={enc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(enc)}>
                    <TableCell>
                      <Badge className={`${ESTADO_ENCUESTA_COLOR[enc.estado]} text-[11px]`}>{ESTADO_ENCUESTA_LABEL[enc.estado]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{enc.nombre || "Sin título"}</div>
                      <div className="text-xs text-muted-foreground">{enc.fechaCreacion} · {enc.creadorNombre}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex -space-x-1">
                        {empleados.slice(0, Math.min(destTotal, 4)).map((em) => (
                          <div key={em.empleadoId} className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-semibold border-2 border-background">
                            {em.nombre[0]}{em.apellidos[0]}
                          </div>
                        ))}
                        {destTotal > 4 && <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-semibold border-2 border-background">+{destTotal - 4}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{resp}/{destTotal}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onSelect(enc); }}>Ver resultados</Button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onSelect(enc)}>Editar</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onEliminar(enc.id)}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DetalleEncuesta({
  encuesta: initial, empleados, onBack, onSaved,
}: {
  encuesta: Encuesta;
  empleados: EmpleadoActivo[];
  onBack: () => void;
  onSaved?: () => void;
}) {
  const [enc, setEnc] = useState<Encuesta>({ ...initial, grupos: initial.grupos.map((g) => ({ ...g, preguntas: g.preguntas.map((p) => ({ ...p, opciones: [...p.opciones] })) })) });
  const [tab, setTab] = useState("cuestionario");
  const [grupoSel, setGrupoSel] = useState(0);
  const [guardando, setGuardando] = useState(false);

  // Persiste el modelo rico completo en BD con el estado indicado.
  const persist = async (estado: EstadoEncuesta) => {
    const next = { ...enc, estado };
    setEnc(next);
    setGuardando(true);
    const res = await saveEncuesta(next);
    setGuardando(false);
    if (res.ok) {
      toast.success(estado === "activa" ? "Encuesta publicada" : "Borrador guardado");
      onSaved?.();
    } else {
      toast.error(res.error ?? "Error al guardar");
    }
  };

  const totalPreguntas = enc.grupos.reduce((s, g) => s + g.preguntas.length, 0);
  const update = (partial: Partial<Encuesta>) => setEnc((prev) => ({ ...prev, ...partial }));

  const addGrupo = () => {
    const g: GrupoPreguntas = { id: `g-${Date.now()}`, titulo: `Grupo ${enc.grupos.length + 1}`, descripcion: "", preguntas: [] };
    update({ grupos: [...enc.grupos, g] });
    setGrupoSel(enc.grupos.length);
  };
  const updateGrupo = (idx: number, partial: Partial<GrupoPreguntas>) => {
    const gs = [...enc.grupos]; gs[idx] = { ...gs[idx], ...partial }; update({ grupos: gs });
  };
  const removeGrupo = (idx: number) => {
    const gs = enc.grupos.filter((_, i) => i !== idx);
    update({ grupos: gs }); setGrupoSel(Math.max(0, grupoSel - 1));
  };

  const addPregunta = (gIdx: number) => {
    const p: PreguntaEncuesta = { id: `p-${Date.now()}`, titulo: "", tipo: "unica", obligatoria: true, opciones: [], puntuacion: false };
    const gs = [...enc.grupos]; gs[gIdx] = { ...gs[gIdx], preguntas: [...gs[gIdx].preguntas, p] }; update({ grupos: gs });
  };
  const updatePregunta = (gIdx: number, pIdx: number, partial: Partial<PreguntaEncuesta>) => {
    const gs = [...enc.grupos]; const ps = [...gs[gIdx].preguntas]; ps[pIdx] = { ...ps[pIdx], ...partial };
    gs[gIdx] = { ...gs[gIdx], preguntas: ps }; update({ grupos: gs });
  };
  const removePregunta = (gIdx: number, pIdx: number) => {
    const gs = [...enc.grupos]; gs[gIdx] = { ...gs[gIdx], preguntas: gs[gIdx].preguntas.filter((_, i) => i !== pIdx) }; update({ grupos: gs });
  };

  const addOpcion = (gIdx: number, pIdx: number) => {
    const preg = enc.grupos[gIdx].preguntas[pIdx];
    const op: OpcionRespuesta = { id: `o-${Date.now()}`, texto: "", color: COLORES_OPCIONES[preg.opciones.length % COLORES_OPCIONES.length] };
    updatePregunta(gIdx, pIdx, { opciones: [...preg.opciones, op] });
  };
  const updateOpcion = (gIdx: number, pIdx: number, oIdx: number, partial: Partial<OpcionRespuesta>) => {
    const ops = [...enc.grupos[gIdx].preguntas[pIdx].opciones]; ops[oIdx] = { ...ops[oIdx], ...partial };
    updatePregunta(gIdx, pIdx, { opciones: ops });
  };
  const removeOpcion = (gIdx: number, pIdx: number, oIdx: number) => {
    const ops = enc.grupos[gIdx].preguntas[pIdx].opciones.filter((_, i) => i !== oIdx);
    updatePregunta(gIdx, pIdx, { opciones: ops });
  };

  const grupo = enc.grupos[grupoSel] as GrupoPreguntas | undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <Input value={enc.nombre} onChange={(e) => update({ nombre: e.target.value })} placeholder="Nombre de la encuesta" className="text-xl font-bold border-none shadow-none px-0 focus-visible:ring-0 h-auto" />
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`${ESTADO_ENCUESTA_COLOR[enc.estado]} text-[11px]`}>{ESTADO_ENCUESTA_LABEL[enc.estado]}</Badge>
            <span className="text-xs text-muted-foreground">{enc.fechaCreacion} · {enc.creadorNombre}</span>
            {enc.fechaCierre && <span className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" />Cierre: {enc.fechaCierre}</span>}
          </div>
        </div>
        <Button variant="outline" disabled={guardando} onClick={() => persist("borrador")}>Guardar borrador</Button>
        <Button disabled={guardando} onClick={() => persist("activa")}>Publicar</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="cuestionario" className="gap-1"><ClipboardList className="h-4 w-4" />Cuestionario</TabsTrigger>
          <TabsTrigger value="empleados" className="gap-1"><Users className="h-4 w-4" />Empleados</TabsTrigger>
          <TabsTrigger value="configuracion" aria-label="Configuración" className="ml-auto"><Settings2 className="h-4 w-4" strokeWidth={1.75} /></TabsTrigger>
          <TabsTrigger value="resultados" className="gap-1"><BarChart3 className="h-4 w-4" />Resultados</TabsTrigger>
        </TabsList>

        <TabsContent value="cuestionario">
          <div className="grid grid-cols-[240px_1fr] gap-4 mt-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Grupos</div>
              {enc.grupos.map((g, i) => (
                <div key={g.id} onClick={() => setGrupoSel(i)} className={`flex items-center gap-2 rounded-md px-3 py-2 cursor-pointer text-sm transition-colors ${grupoSel === i ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"}`}>
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  <span className="truncate flex-1">{g.titulo || "Sin título"}</span>
                  <span className="text-[10px] text-muted-foreground">{g.preguntas.length}</span>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full justify-start gap-1 text-muted-foreground" onClick={addGrupo}>
                <Plus className="h-3.5 w-3.5" />Añadir grupo
              </Button>
              <Separator className="my-2" />
              <div className="text-[11px] text-muted-foreground">Total: {totalPreguntas} preguntas</div>
            </div>

            <div className="space-y-4">
              {!grupo ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">Crea un grupo para empezar a añadir preguntas</CardContent></Card>
              ) : (
                <>
                  <Card>
                    <CardContent className="pt-5 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-2">
                          <Input value={grupo.titulo} onChange={(e) => updateGrupo(grupoSel, { titulo: e.target.value })} placeholder="Título del grupo" className="font-semibold" />
                          <Input value={grupo.descripcion} onChange={(e) => updateGrupo(grupoSel, { descripcion: e.target.value })} placeholder="Descripción (opcional)" className="text-sm" />
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeGrupo(grupoSel)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>

                  {grupo.preguntas.map((preg, pIdx) => (
                    <Card key={preg.id}>
                      <CardContent className="pt-5 space-y-3">
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-bold text-muted-foreground mt-2.5">{pIdx + 1}.</span>
                          <div className="flex-1 space-y-3">
                            <Input value={preg.titulo} onChange={(e) => updatePregunta(grupoSel, pIdx, { titulo: e.target.value })} placeholder="Título de la pregunta" />
                            <div className="flex flex-wrap items-center gap-3">
                              <Select value={preg.tipo} onValueChange={(v) => updatePregunta(grupoSel, pIdx, { tipo: v as TipoPregunta })}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(TIPO_PREGUNTA_LABEL) as TipoPregunta[]).map((t) => (
                                    <SelectItem key={t} value={t}>{TIPO_PREGUNTA_LABEL[t]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <label className="flex items-center gap-1.5 text-sm">
                                <Checkbox checked={preg.obligatoria} onCheckedChange={(c) => updatePregunta(grupoSel, pIdx, { obligatoria: !!c })} />Obligatoria
                              </label>
                              <label className="flex items-center gap-1.5 text-sm">
                                <Checkbox checked={preg.puntuacion} onCheckedChange={(c) => updatePregunta(grupoSel, pIdx, { puntuacion: !!c })} />Puntuación
                              </label>
                            </div>

                            {(preg.tipo === "unica" || preg.tipo === "multiple") && (
                              <div className="space-y-2 pl-1">
                                {preg.opciones.map((op, oIdx) => (
                                  <div key={op.id} className="flex items-center gap-2">
                                    <input type="color" value={op.color} onChange={(e) => updateOpcion(grupoSel, pIdx, oIdx, { color: e.target.value })} className="h-6 w-6 rounded cursor-pointer border-0 p-0" />
                                    <Input value={op.texto} onChange={(e) => updateOpcion(grupoSel, pIdx, oIdx, { texto: e.target.value })} placeholder={`Opción ${oIdx + 1}`} className="flex-1" />
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeOpcion(grupoSel, pIdx, oIdx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                ))}
                                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => addOpcion(grupoSel, pIdx)}>
                                  <Plus className="h-3.5 w-3.5 mr-1" />Añadir opción
                                </Button>
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="text-destructive mt-1" onClick={() => removePregunta(grupoSel, pIdx)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  <Button variant="outline" className="w-full" onClick={() => addPregunta(grupoSel)}>
                    <Plus className="h-4 w-4 mr-1" />Añadir pregunta
                  </Button>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="empleados">
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-base">Destinatarios</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={enc.destinatarios.tipo} onValueChange={(v) => update({ destinatarios: { tipo: v as Encuesta["destinatarios"]["tipo"], ids: [] } })}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Toda la empresa</SelectItem>
                  <SelectItem value="departamentos">Por departamento</SelectItem>
                  <SelectItem value="roles">Por rol</SelectItem>
                  <SelectItem value="empleados">Empleados concretos</SelectItem>
                </SelectContent>
              </Select>

              {enc.destinatarios.tipo === "departamentos" && (
                <div className="flex flex-wrap gap-2">
                  {DEPARTAMENTOS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-sm">
                      <Checkbox checked={enc.destinatarios.ids.includes(d)} onCheckedChange={(c) => {
                        const ids = c ? [...enc.destinatarios.ids, d] : enc.destinatarios.ids.filter((x) => x !== d);
                        update({ destinatarios: { ...enc.destinatarios, ids } });
                      }} />{d}
                    </label>
                  ))}
                </div>
              )}

              {enc.destinatarios.tipo === "empleados" && (
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {empleados.map((em) => (
                    <label key={em.empleadoId} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted cursor-pointer">
                      <Checkbox checked={enc.destinatarios.ids.includes(em.empleadoId)} onCheckedChange={(c) => {
                        const ids = c ? [...enc.destinatarios.ids, em.empleadoId] : enc.destinatarios.ids.filter((x) => x !== em.empleadoId);
                        update({ destinatarios: { ...enc.destinatarios, ids } });
                      }} />
                      <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">{em.nombre[0]}{em.apellidos[0]}</div>
                      <span>{em.nombre} {em.apellidos}</span>
                    </label>
                  ))}
                </div>
              )}

              {enc.destinatarios.tipo === "todos" && (
                <p className="text-sm text-muted-foreground">Se enviará a todos los empleados de la empresa ({empleados.length} empleados).</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracion">
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Descripción</Label>
                  <Textarea value={enc.descripcion} onChange={(e) => update({ descripcion: e.target.value })} rows={3} />
                </div>
                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select value={enc.estado} onValueChange={(v) => update({ estado: v as EstadoEncuesta })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ESTADO_ENCUESTA_LABEL) as EstadoEncuesta[]).map((s) => (
                        <SelectItem key={s} value={s}>{ESTADO_ENCUESTA_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Fecha apertura</Label>
                    <Input type="date" value={enc.fechaCreacion} onChange={(e) => update({ fechaCreacion: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Fecha cierre</Label>
                    <Input type="date" value={enc.fechaCierre} onChange={(e) => update({ fechaCierre: e.target.value })} />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Opciones</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between"><Label>Encuesta anónima</Label><Switch checked={enc.anonima} onCheckedChange={(c) => update({ anonima: c })} /></div>
                <div className="flex items-center justify-between"><Label>Solo una respuesta</Label><Switch checked={enc.unaRespuesta} onCheckedChange={(c) => update({ unaRespuesta: c })} /></div>
                <div className="flex items-center justify-between"><Label>Permitir modificar respuesta</Label><Switch checked={enc.modificarRespuesta} onCheckedChange={(c) => update({ modificarRespuesta: c })} /></div>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Mensajes</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1"><Label>Mensaje inicial</Label><Textarea value={enc.mensajeInicial} onChange={(e) => update({ mensajeInicial: e.target.value })} rows={3} /></div>
                <div className="space-y-1"><Label>Mensaje final</Label><Textarea value={enc.mensajeFinal} onChange={(e) => update({ mensajeFinal: e.target.value })} rows={3} /></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resultados">
          <ResultadosTab encuesta={enc} empleados={empleados} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultadosTab({ encuesta, empleados }: { encuesta: Encuesta; empleados: EmpleadoActivo[] }) {
  const totalDest = encuesta.destinatarios.tipo === "todos" ? empleados.length : (encuesta.destinatarios.ids.length || empleados.length);
  const totalResp = encuesta.respuestas.length;
  const pct = totalDest > 0 ? Math.round((totalResp / totalDest) * 100) : 0;

  if (totalResp === 0) {
    return (
      <Card className="mt-4"><CardContent className="py-16 text-center text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Sin respuestas todavía</p>
        <p className="text-sm">Los resultados aparecerán cuando los empleados respondan la encuesta.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-5 text-center"><div className="text-3xl font-bold text-foreground">{totalResp}</div><div className="text-sm text-muted-foreground">Respuestas</div></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><div className="text-3xl font-bold text-foreground">{pct}%</div><div className="text-sm text-muted-foreground">Participación</div></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><div className="text-3xl font-bold text-foreground">{encuesta.grupos.reduce((s, g) => s + g.preguntas.length, 0)}</div><div className="text-sm text-muted-foreground">Preguntas</div></CardContent></Card>
      </div>

      {encuesta.grupos.map((grupo) => (
        <div key={grupo.id} className="space-y-4">
          <h3 className="font-semibold text-foreground">{grupo.titulo}</h3>
          {grupo.preguntas.map((preg) => (
            <PreguntaResultado key={preg.id} pregunta={preg} respuestas={encuesta.respuestas} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PreguntaResultado({ pregunta, respuestas }: { pregunta: PreguntaEncuesta; respuestas: Encuesta["respuestas"] }) {
  const vals = respuestas.map((r) => r.respuestas[pregunta.id]).filter((v) => v !== undefined && v !== "");

  if (pregunta.tipo === "valoracion" || pregunta.tipo === "escala") {
    const nums = vals.filter((v) => typeof v === "number") as number[];
    const avg = nums.length > 0 ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : "—";
    const max = pregunta.tipo === "valoracion" ? 5 : 10;
    const dist: Record<number, number> = {};
    nums.forEach((n) => { dist[n] = (dist[n] || 0) + 1; });
    const chartData = Array.from({ length: max }, (_, i) => ({ name: String(i + 1), value: dist[i + 1] || 0 }));
    const config = { value: { label: "Respuestas", color: "hsl(var(--primary))" } };
    return (
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-sm">{pregunta.titulo}</span>
            <span className="text-2xl font-bold text-primary">{avg}<span className="text-sm text-muted-foreground font-normal">/{max}</span></span>
          </div>
          <ChartContainer config={config} className="h-[120px]">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={24} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  }

  if (pregunta.tipo === "si_no") {
    const si = vals.filter((v) => v === "si").length;
    const no = vals.filter((v) => v === "no").length;
    const total = si + no;
    const data = [{ name: "Sí", value: si }, { name: "No", value: no }];
    const colors = ["#22c55e", "#ef4444"];
    return (
      <Card>
        <CardContent className="pt-5 space-y-3">
          <span className="font-medium text-sm">{pregunta.titulo}</span>
          <div className="flex items-center gap-6">
            <div className="h-[100px] w-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={25} outerRadius={45} paddingAngle={2}>
                    {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "#22c55e" }} />Sí: {si} ({total > 0 ? Math.round((si / total) * 100) : 0}%)</div>
              <div className="flex items-center gap-2"><div className="h-3 w-3 rounded-sm" style={{ backgroundColor: "#ef4444" }} />No: {no} ({total > 0 ? Math.round((no / total) * 100) : 0}%)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if ((pregunta.tipo === "unica" || pregunta.tipo === "multiple") && pregunta.opciones.length > 0) {
    const counts: Record<string, number> = {};
    pregunta.opciones.forEach((op) => { counts[op.id] = 0; });
    vals.forEach((v) => {
      if (Array.isArray(v)) v.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
      else if (typeof v === "string") counts[v] = (counts[v] || 0) + 1;
    });
    const total = vals.length;
    const chartData = pregunta.opciones.map((op) => ({ name: op.texto || op.id, value: counts[op.id] || 0, color: op.color }));
    return (
      <Card>
        <CardContent className="pt-5 space-y-3">
          <span className="font-medium text-sm">{pregunta.titulo}</span>
          <div className="space-y-2">
            {chartData.map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-sm flex-1 truncate">{d.name}</span>
                <div className="w-32"><Progress value={total > 0 ? (d.value / total) * 100 : 0} className="h-2" /></div>
                <span className="text-xs text-muted-foreground w-12 text-right">{d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <span className="font-medium text-sm">{pregunta.titulo}</span>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {vals.length === 0 && <p className="text-sm text-muted-foreground">Sin respuestas</p>}
          {vals.map((v, i) => (
            <div key={i} className="text-sm bg-muted/50 rounded px-3 py-2">{String(v)}</div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function EncuestasView() {
  const { empresaActual } = useEmpresa();
  const eId = empresaActual.id;
  // OLA2-01: empleados reales (fuente única). Antes venían del mock data/rrhh.ts.
  const [empleados, setEmpleados] = useState<EmpleadoActivo[]>([]);
  useEffect(() => {
    let alive = true;
    getEmpleadosActivos(empresaActual.dbId).then((r) => {
      if (alive) setEmpleados(r.ok ? r.data : []);
    });
    return () => {
      alive = false;
    };
  }, [empresaActual.dbId]);
  const [encuestas, setEncuestas] = useState<Encuesta[]>([]);
  const [_loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Encuesta | null>(null);

  const loadEncuestas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listEncuestas();
      setEncuestas(res.ok ? res.data : []);
    } catch {
      setEncuestas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEncuestas();
  }, [loadEncuestas]);

  const handleCrear = async () => {
    const primera = empleados[0];
    const nueva = crearEncuestaVacia(eId, primera?.empleadoId || "", primera ? `${primera.nombre} ${primera.apellidos}` : "Sistema");
    const res = await createEncuesta(nueva);
    if (res.ok && res.data) {
      setEncuestas((prev) => [res.data!, ...prev]);
      setSelected(res.data);
      toast.success("Encuesta creada");
    } else {
      toast.error(res.error ?? "Error al crear encuesta");
    }
  };

  const handleEliminar = async (id: string) => {
    const res = await deleteEncuesta(id);
    if (res.ok) {
      setEncuestas((prev) => prev.filter((e) => e.id !== id));
      toast.success("Encuesta eliminada");
    } else {
      toast.error(res.error ?? "Error al eliminar");
    }
  };

  if (selected) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <DetalleEncuesta
          encuesta={selected}
          empleados={empleados}
          onBack={() => setSelected(null)}
          onSaved={loadEncuestas}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <ListadoEncuestas encuestas={encuestas} empleados={empleados} onSelect={setSelected} onCrear={handleCrear} onEliminar={handleEliminar} />
    </div>
  );
}
