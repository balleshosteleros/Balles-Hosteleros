"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  buscarClientesParaAlumno,
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
  /** Nombre de la ficha de cliente enganchada, solo para pintarla. */
  const [clienteNombre, setClienteNombre] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [candidatos, setCandidatos] = useState<{ id: string; nombre: string; email?: string }[]>([]);

  useEffect(() => {
    if (!abierto) return;
    setError("");
    setMatriculas(alumno?.cursosMatriculados ?? []);
    setClienteNombre(alumno?.clienteNombre ?? "");
    setBuscaCliente("");
    setCandidatos([]);
    setForm(
      alumno
        ? {
            nombre: alumno.nombre,
            email: alumno.email,
            telefono: alumno.telefono ?? "",
            empresaClienteId: alumno.empresaClienteId ?? "",
            clienteId: alumno.clienteId ?? "",
            accesoTotal: alumno.accesoTotal,
            estado: alumno.estado,
          }
        : vacio(),
    );
  }, [abierto, alumno]);

  // Buscador de fichas de cliente: espera a que se deje de escribir.
  useEffect(() => {
    if (!abierto || form.clienteId) return;
    const q = buscaCliente.trim();
    if (q.length < 2) {
      setCandidatos([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await buscarClientesParaAlumno(q);
      setCandidatos(res.data);
    }, 300);
    return () => clearTimeout(t);
  }, [abierto, buscaCliente, form.clienteId]);

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
            <Label>Ficha de cliente</Label>
            {form.clienteId ? (
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{clienteNombre || "Ficha enganchada"}</p>
                  <p className="text-xs text-muted-foreground">
                    Es la misma persona en clientes y en la escuela.
                  </p>
                </div>
                <Link
                  href={`/producto/clientes?cliente=${form.clienteId}`}
                  className="shrink-0 text-sm font-medium text-primary hover:underline"
                >
                  Ver ficha
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    set("clienteId", "");
                    setClienteNombre("");
                  }}
                >
                  Quitar
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Buscar por nombre o correo"
                />
                {candidatos.length ? (
                  <ul className="max-h-40 divide-y overflow-y-auto rounded-lg border">
                    {candidatos.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                          onClick={() => {
                            set("clienteId", c.id);
                            setClienteNombre(c.nombre);
                            setBuscaCliente("");
                            setCandidatos([]);
                          }}
                        >
                          <span className="font-medium">{c.nombre}</span>
                          {c.email ? (
                            <span className="text-muted-foreground"> · {c.email}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Si lo dejas vacío se engancha sola con la ficha que tenga su mismo correo.
                  </p>
                )}
              </div>
            )}
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
    clienteId: "",
    accesoTotal: true,
    estado: "ACTIVO",
  };
}
