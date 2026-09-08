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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  actualizarAlumno,
  crearAlumno,
  guardarMatriculas,
  type EntradaAlumno,
} from "../../actions/alumnos-actions";
import type { AlumnoEscuela } from "../../types";

/**
 * Alta y edición de un alumno.
 *
 * Por defecto un alumno ve TODOS los cursos publicados: la escuela va incluida
 * con el software. Solo si se le quita el acceso completo hay que decirle a qué
 * cursos entra.
 */
export function AlumnoDialog({
  abierto,
  alumno,
  cursos,
  empresas,
  onCerrar,
  onGuardado,
}: {
  abierto: boolean;
  alumno: AlumnoEscuela | null;
  cursos: { id: string; titulo: string }[];
  empresas: { id: string; nombre: string }[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState<EntradaAlumno>(vacio());
  const [matriculas, setMatriculas] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setError("");
    setMatriculas(alumno?.cursosMatriculados ?? []);
    setForm(
      alumno
        ? {
            nombre: alumno.nombre,
            email: alumno.email,
            telefono: alumno.telefono ?? "",
            empresaClienteId: alumno.empresaClienteId ?? "",
            accesoTotal: alumno.accesoTotal,
            estado: alumno.estado,
          }
        : vacio(),
    );
  }, [abierto, alumno]);

  async function guardar() {
    setGuardando(true);
    setError("");
    const res = alumno ? await actualizarAlumno(alumno.id, form) : await crearAlumno(form);
    if (!res.ok) {
      setGuardando(false);
      setError(res.error ?? "No se pudo guardar.");
      return;
    }
    const alumnoId = alumno?.id ?? ("id" in res ? (res.id as string | undefined) : undefined);
    if (alumnoId) {
      // Con acceso total la matrícula fina sobra: se limpia para que no quede
      // una lista antigua decidiendo lo que ve.
      await guardarMatriculas(alumnoId, form.accesoTotal ? [] : matriculas);
    }
    setGuardando(false);
    onGuardado();
    onCerrar();
  }

  function set<K extends keyof EntradaAlumno>(campo: K, valor: EntradaAlumno[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{alumno ? "Editar alumno" : "Nuevo alumno"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="alumno@restaurante.com"
            />
            <p className="text-xs text-muted-foreground">
              Es el correo con el que entra: ahí recibe su código.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={form.telefono ?? ""}
              onChange={(e) => set("telefono", e.target.value)}
            />
          </div>

          {empresas.length ? (
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Select
                value={form.empresaClienteId || "ninguna"}
                onValueChange={(v) => set("empresaClienteId", v === "ninguna" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ninguna" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Ninguna</SelectItem>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Activo</p>
              <p className="text-xs text-muted-foreground">
                Si lo apagas, deja de poder entrar al instante.
              </p>
            </div>
            <Switch
              checked={form.estado === "ACTIVO"}
              onCheckedChange={(v) => set("estado", v ? "ACTIVO" : "INACTIVO")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ve todos los cursos</p>
              <p className="text-xs text-muted-foreground">
                Apágalo para elegir a mano a cuáles entra.
              </p>
            </div>
            <Switch
              checked={form.accesoTotal ?? true}
              onCheckedChange={(v) => set("accesoTotal", v)}
            />
          </div>

          {!form.accesoTotal ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Cursos a los que entra</p>
              {cursos.length ? (
                cursos.map((c) => (
                  <label key={c.id} className="flex items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={matriculas.includes(c.id)}
                      onCheckedChange={(v) =>
                        setMatriculas((prev) =>
                          v ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                        )
                      }
                    />
                    {c.titulo}
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Todavía no hay cursos.</p>
              )}
            </div>
          ) : null}

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

function vacio(): EntradaAlumno {
  return {
    nombre: "",
    email: "",
    telefono: "",
    empresaClienteId: "",
    accesoTotal: true,
    estado: "ACTIVO",
  };
}
