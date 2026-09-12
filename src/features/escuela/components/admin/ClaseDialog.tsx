"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectorFecha } from "@/components/ui/selector-fecha";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { crearClase, actualizarClase, type EntradaClase } from "../../actions/clases-actions";
import { TIPOS_CLASE, type ClaseEscuela } from "../../types";
import { SelectorHora } from "@/components/ui/selector-hora";

/**
 * Alta y edición de una clase del calendario.
 *
 * La fecha y la hora se escriben tal cual se dan: son las de la escuela, no las
 * del navegador de quien las apunta.
 */
export function ClaseDialog({
  abierto,
  clase,
  cursos,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  clase: ClaseEscuela | null;
  cursos: { id: string; titulo: string }[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState<EntradaClase>(vacio());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setError("");
    setForm(
      clase
        ? {
            titulo: clase.titulo,
            descripcion: clase.descripcion,
            tipo: clase.tipo,
            fecha: clase.fecha,
            horaInicio: clase.horaInicio,
            horaFin: clase.horaFin ?? "",
            enlace: clase.enlace ?? "",
            grabacionUrl: clase.grabacionUrl ?? "",
            cover: clase.cover ?? "",
            cursoId: clase.cursoId ?? "",
            publicado: clase.publicado,
          }
        : vacio(),
    );
  }, [abierto, clase]);

  async function guardar() {
    setGuardando(true);
    setError("");
    const res = clase ? await actualizarClase(clase.id, form) : await crearClase(form);
    setGuardando(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo guardar.");
      return;
    }
    onGuardado();
    onCerrar();
  }

  function set<K extends keyof EntradaClase>(campo: K, valor: EntradaClase[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clase ? "Editar clase" : "Nueva clase"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Clase máster módulo 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set("tipo", v as EntradaClase["tipo"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CLASE.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fecha">Fecha</Label>
              {/* Calendario propio: el del navegador sale distinto en cada
                  equipo y en el idioma del sistema. */}
              <SelectorFecha id="fecha" value={form.fecha} onChange={(v) => set("fecha", v)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inicio">Empieza</Label>
              <SelectorHora id="inicio" 
                value={form.horaInicio}
                onChange={(valor) => set("horaInicio", valor)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin">Termina</Label>
              <SelectorHora id="fin" 
                value={form.horaFin ?? ""}
                onChange={(valor) => set("horaFin", valor)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              rows={3}
              value={form.descripcion ?? ""}
              onChange={(e) => set("descripcion", e.target.value)}
              placeholder="Qué se ve en esta clase"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="enlace">Enlace de la clase</Label>
            <Input
              id="enlace"
              value={form.enlace ?? ""}
              onChange={(e) => set("enlace", e.target.value)}
              placeholder="https://meet.google.com/…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grabacion">Grabación</Label>
            <Input
              id="grabacion"
              value={form.grabacionUrl ?? ""}
              onChange={(e) => set("grabacionUrl", e.target.value)}
              placeholder="https://youtu.be/…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cover">Miniatura</Label>
            <Input
              id="cover"
              value={form.cover ?? ""}
              onChange={(e) => set("cover", e.target.value)}
              placeholder="Dirección de una imagen (opcional)"
            />
            <p className="text-xs text-muted-foreground">
              Si la dejas vacía, la miniatura se pinta con la imagen de marca.
            </p>
          </div>

          {cursos.length ? (
            <div className="space-y-1.5">
              <Label>Curso relacionado</Label>
              <Select
                value={form.cursoId || "ninguno"}
                onValueChange={(v) => set("cursoId", v === "ninguno" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">Ninguno</SelectItem>
                  {cursos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.titulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Visible para los alumnos</p>
              <p className="text-xs text-muted-foreground">
                Si la apagas, la clase solo se ve desde aquí.
              </p>
            </div>
            <Switch
              checked={form.publicado ?? true}
              onCheckedChange={(v) => set("publicado", v)}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function vacio(): EntradaClase {
  const hoy = new Date();
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate(),
  ).padStart(2, "0")}`;
  return {
    titulo: "",
    descripcion: "",
    tipo: "CLASE",
    fecha,
    horaInicio: "11:00",
    horaFin: "",
    enlace: "",
    grabacionUrl: "",
    cover: "",
    cursoId: "",
    publicado: true,
  };
}
