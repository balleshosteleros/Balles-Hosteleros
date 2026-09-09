"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IdCard, Mail, Pencil, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/shared/hooks/use-toast";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { borrarAlumno, enviarBienvenida, listAlumnos } from "../../actions/alumnos-actions";
import { fechaLarga } from "../../lib/calendario";
import type { AlumnoEscuela } from "../../types";
import { AlumnoDialog } from "./AlumnoDialog";

/**
 * Alumnos de la escuela: quién entra, a qué entra y qué lleva hecho.
 *
 * Nadie se registra solo: el alta se hace aquí. Quien entra desde dentro del
 * software se da de alta al vuelo y aparece con origen «Desde el software».
 */
export function AlumnosTab({
  cursos,
  empresas,
}: {
  cursos: { id: string; titulo: string }[];
  empresas: { id: string; nombre: string }[];
}) {
  const { toast } = useToast();
  const [alumnos, setAlumnos] = useState<AlumnoEscuela[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<AlumnoEscuela | null>(null);
  const [abierto, setAbierto] = useState(false);
  const { confirm, dialog } = useConfirmDelete();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  async function recargar() {
    const res = await listAlumnos();
    setAlumnos(res.data);
    setCargando(false);
  }

  useEffect(() => {
    void recargar();
  }, []);

  /**
   * Alumno pedido por URL (`?alumno=<id>`). Es como se llega desde la ficha de
   * cliente: la del alumno se abre sola, sin buscarlo entre los cincuenta.
   */
  const alumnoPedido = searchParams?.get("alumno") ?? null;
  useEffect(() => {
    if (!alumnoPedido || alumnos.length === 0) return;
    if (editando?.id === alumnoPedido) return;
    const a = alumnos.find((x) => x.id === alumnoPedido);
    if (a) {
      setEditando(a);
      setAbierto(true);
    }
    // `editando` queda fuera a propósito: solo hay que reaccionar a que cambie
    // la URL o a que acaben de llegar los alumnos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoPedido, alumnos]);

  /**
   * Cerrar es cerrar: si el id se queda en la URL, el efecto de arriba vuelve a
   * abrir la ficha y no hay manera de salir.
   */
  function cerrarFicha() {
    setAbierto(false);
    if (searchParams?.get("alumno")) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("alumno");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return alumnos;
    return alumnos.filter(
      (a) => a.nombre.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }, [alumnos, busqueda]);

  async function eliminar(alumno: AlumnoEscuela) {
    const ok = await confirm({
      title: "Borrar el alumno",
      description: `${alumno.nombre || alumno.email} perderá el acceso y su progreso.`,
    });
    if (!ok) return;
    await borrarAlumno(alumno.id);
    void recargar();
  }

  async function bienvenida(alumno: AlumnoEscuela) {
    const res = await enviarBienvenida(alumno.id);
    toast(
      res.ok
        ? { title: "Correo enviado", description: `Le ha llegado a ${alumno.email}.` }
        : { title: "No se pudo enviar", description: res.error, variant: "destructive" },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nombre o correo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
        <Button
          className="ml-auto"
          onClick={() => {
            setEditando(null);
            setAbierto(true);
          }}
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Nuevo alumno
        </Button>
      </div>

      {cargando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : filtrados.length ? (
        <ul className="divide-y rounded-xl border bg-background">
          {filtrados.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{a.nombre || a.email}</span>
                  {a.estado === "INACTIVO" ? (
                    <Badge variant="outline" className="text-xs">
                      Inactivo
                    </Badge>
                  ) : null}
                  {!a.accesoTotal ? (
                    <Badge variant="secondary" className="text-xs">
                      {a.cursosMatriculados.length}{" "}
                      {a.cursosMatriculados.length === 1 ? "curso" : "cursos"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {a.email}
                  {a.empresaClienteNombre ? ` · ${a.empresaClienteNombre}` : ""} ·{" "}
                  {a.leccionesCompletadas}{" "}
                  {a.leccionesCompletadas === 1 ? "lección vista" : "lecciones vistas"}
                  {a.ultimoAccesoAt
                    ? ` · última entrada ${fechaLarga(a.ultimoAccesoAt.slice(0, 10))}`
                    : " · sin entrar todavía"}
                  {a.accesosNum > 0
                    ? ` · ${a.accesosNum} ${a.accesosNum === 1 ? "entrada" : "entradas"}`
                    : ""}
                </p>
                {a.clienteId ? (
                  <Link
                    href={`/producto/clientes?cliente=${a.clienteId}`}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <IdCard className="h-3.5 w-3.5" />
                    Ficha de cliente
                  </Link>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => bienvenida(a)}
                aria-label="Enviar la bienvenida"
              >
                <Mail className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditando(a);
                  setAbierto(true);
                }}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => eliminar(a)} aria-label="Borrar">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todavía no hay ningún alumno dado de alta.
        </div>
      )}

      <AlumnoDialog
        abierto={abierto}
        alumno={editando}
        cursos={cursos}
        empresas={empresas}
        onCerrar={cerrarFicha}
        onGuardado={recargar}
      />
      {dialog}
    </div>
  );
}
