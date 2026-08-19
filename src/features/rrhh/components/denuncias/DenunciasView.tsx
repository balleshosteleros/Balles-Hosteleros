"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle, Inbox, Lock, MessageSquareWarning, Search, UserRound, VenetianMask,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import {
  listDenunciasRRHH, actualizarDenuncia, puedeVerDenuncias,
  type DenunciaRow, type EstadoDenuncia,
} from "@/features/mi-panel/actions/denuncias-actions";
import { CATEGORIA_LABEL } from "@/features/mi-panel/components/DenunciaModal";

const ESTADO_LABEL: Record<EstadoDenuncia, string> = {
  recibida: "Recibida",
  en_investigacion: "En investigación",
  informacion_solicitada: "Información solicitada",
  resuelta: "Resuelta",
  archivada: "Archivada",
};

const ESTADOS = Object.keys(ESTADO_LABEL) as EstadoDenuncia[];

const ESTADO_COLOR: Record<EstadoDenuncia, string> = {
  recibida: "bg-blue-100 text-blue-800 border-blue-300",
  en_investigacion: "bg-amber-100 text-amber-800 border-amber-300",
  informacion_solicitada: "bg-purple-100 text-purple-800 border-purple-300",
  resuelta: "bg-emerald-100 text-emerald-800 border-emerald-300",
  archivada: "bg-slate-100 text-slate-600 border-slate-300",
};

/**
 * Panel de denuncias. Se usa embebido como pestaña dentro de Solicitudes
 * (todo se gestiona desde el mismo sitio) y también como vista propia.
 */
export function DenunciasPanel({ embebido = false }: { embebido?: boolean }) {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [items, setItems] = useState<DenunciaRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [buscar, setBuscar] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [sel, setSel] = useState<DenunciaRow | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const permitido = await puedeVerDenuncias();
    setAutorizado(permitido);
    if (permitido) {
      const res = await listDenunciasRRHH();
      if (res.ok) setItems(res.data);
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtradas = useMemo(() => items.filter((d) => {
    if (filtroEstado !== "todos" && d.estado !== filtroEstado) return false;
    if (buscar) {
      const q = buscar.toLowerCase();
      if (!d.asunto.toLowerCase().includes(q) && !d.relato.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, buscar, filtroEstado]);

  const resumen = useMemo(() => ({
    total: items.length,
    abiertas: items.filter((d) => d.estado !== "resuelta" && d.estado !== "archivada").length,
    anonimas: items.filter((d) => d.modalidad === "anonima").length,
    nominales: items.filter((d) => d.modalidad === "nominal").length,
  }), [items]);

  if (autorizado === false) {
    return (
      <div className={embebido ? "" : "p-6"}>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No tienes acceso a este apartado</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Las quejas y denuncias solo son accesibles para quien tiene permiso sobre
              Recursos Humanos. Es una restricción del propio protocolo: la
              confidencialidad es lo que hace que la gente se atreva a usar el canal.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={embebido ? "space-y-6" : "p-6 space-y-6 pb-28"}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center"><Inbox className="h-5 w-5 text-muted-foreground" /></div>
          <div><p className="text-2xl font-bold">{resumen.total}</p><p className="text-xs text-muted-foreground">Recibidas</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
          <div><p className="text-2xl font-bold text-amber-700">{resumen.abiertas}</p><p className="text-xs text-muted-foreground">Sin cerrar</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><UserRound className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{resumen.nominales}</p><p className="text-xs text-muted-foreground">En su nombre</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center"><VenetianMask className="h-5 w-5 text-slate-600" /></div>
          <div><p className="text-2xl font-bold">{resumen.anonimas}</p><p className="text-xs text-muted-foreground">Anónimas (estadística)</p></div>
        </CardContent></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por asunto o contenido..." value={buscar} onChange={(e) => setBuscar(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asunto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Presentada</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando && <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Cargando...</TableCell></TableRow>}
            {!cargando && filtradas.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                {items.length === 0 ? "No hay ninguna queja ni denuncia presentada" : "Nada coincide con esos filtros"}
              </TableCell></TableRow>
            )}
            {!cargando && filtradas.map((d) => (
              <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSel(d)}>
                <TableCell>
                  <p className="font-medium">{d.asunto}</p>
                  {d.modalidad === "nominal" && d.denunciante_nombre && (
                    <p className="text-xs text-muted-foreground">{d.denunciante_nombre}</p>
                  )}
                </TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{CATEGORIA_LABEL[d.categoria]}</Badge></TableCell>
                <TableCell>
                  {d.modalidad === "anonima" ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><VenetianMask className="h-3.5 w-3.5" /> Anónima</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs"><UserRound className="h-3.5 w-3.5" /> En su nombre</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">{format(parseISO(d.created_at), "d MMM yyyy", { locale: es })}</TableCell>
                <TableCell><Badge className={`text-xs ${ESTADO_COLOR[d.estado]}`}>{ESTADO_LABEL[d.estado]}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {sel && (
        <DetalleDenuncia
          key={sel.id}
          denuncia={sel}
          onClose={() => setSel(null)}
          onGuardado={async () => { await cargar(); setSel(null); }}
        />
      )}
    </div>
  );
}

function DetalleDenuncia({
  denuncia, onClose, onGuardado,
}: {
  denuncia: DenunciaRow;
  onClose: () => void;
  onGuardado: () => Promise<void>;
}) {
  const [estado, setEstado] = useState<EstadoDenuncia>(denuncia.estado);
  const [respuesta, setRespuesta] = useState(denuncia.respuesta ?? "");
  const [notas, setNotas] = useState(denuncia.notas_internas ?? "");
  const [guardando, setGuardando] = useState(false);

  const esAnonima = denuncia.modalidad === "anonima";

  async function guardar() {
    setGuardando(true);
    const res = await actualizarDenuncia(denuncia.id, {
      estado,
      respuesta: respuesta || null,
      notas_internas: notas || null,
    });
    setGuardando(false);
    if (!res.ok) { toast.error(res.error ?? "No se pudo guardar"); return; }
    toast.success("Actualizado");
    await onGuardado();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <MessageSquareWarning className="h-5 w-5 shrink-0" />
            <span className="flex-1">{denuncia.asunto}</span>
          </DialogTitle>
        </DialogHeader>

        {esAnonima && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="flex gap-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Comunicación anónima.</strong> No puede fundamentar un expediente
                sancionador: sin persona identificada no cabe dar audiencia a la otra
                parte. Trátala como señal de alerta — investiga el hecho por otras vías y
                déjala registrada para estadística.
              </span>
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label className="text-xs text-muted-foreground">Categoría</Label><p className="text-sm font-medium">{CATEGORIA_LABEL[denuncia.categoria]}</p></div>
          <div><Label className="text-xs text-muted-foreground">Presentada</Label><p className="text-sm font-medium">{format(parseISO(denuncia.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}</p></div>
          {!esAnonima && denuncia.denunciante_nombre && (
            <div><Label className="text-xs text-muted-foreground">Presentada por</Label><p className="text-sm font-medium">{denuncia.denunciante_nombre}</p></div>
          )}
          {denuncia.fecha_hechos && (
            <div><Label className="text-xs text-muted-foreground">Fecha de los hechos</Label><p className="text-sm font-medium">{format(parseISO(denuncia.fecha_hechos), "d MMM yyyy", { locale: es })}</p></div>
          )}
          {denuncia.lugar && <div><Label className="text-xs text-muted-foreground">Lugar</Label><p className="text-sm font-medium">{denuncia.lugar}</p></div>}
          {denuncia.personas_implicadas && <div><Label className="text-xs text-muted-foreground">Personas implicadas</Label><p className="text-sm font-medium">{denuncia.personas_implicadas}</p></div>}
          {denuncia.testigos && <div className="sm:col-span-2"><Label className="text-xs text-muted-foreground">Testigos</Label><p className="text-sm font-medium">{denuncia.testigos}</p></div>}
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Relato de los hechos</Label>
          <p className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{denuncia.relato}</p>
        </div>

        <div className="space-y-4 border-t pt-4">
          <div>
            <Label>Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoDenuncia)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ESTADOS.map((e) => <SelectItem key={e} value={e}>{ESTADO_LABEL[e]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Respuesta para quien la presentó</Label>
            <Textarea
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              rows={3}
              placeholder={esAnonima ? "La verá al consultar con su código de seguimiento" : "La verá en su panel"}
            />
          </div>
          <div>
            <Label>Notas internas</Label>
            <Textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Solo visibles para Recursos Humanos"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Vista suelta en /rrhh/denuncias (mismo contenido, con su propio padding). */
export function DenunciasView() {
  return <DenunciasPanel />;
}
