"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { borrarClase, listClases } from "../../actions/clases-actions";
import { fechaLarga } from "../../lib/calendario";
import { TIPOS_CLASE, type ClaseEscuela } from "../../types";
import { ClaseDialog } from "./ClaseDialog";

/**
 * Clases de la escuela: lo que el alumno ve en su calendario, aquí en lista y
 * editable. Se añaden, se cambian y se quitan desde esta pantalla.
 */
export function ClasesTab({ cursos }: { cursos: { id: string; titulo: string }[] }) {
  const [clases, setClases] = useState<ClaseEscuela[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<ClaseEscuela | null>(null);
  const [abierto, setAbierto] = useState(false);
  const { confirm, dialog } = useConfirmDelete();

  async function recargar() {
    const res = await listClases();
    setClases(res.data);
    setCargando(false);
  }

  useEffect(() => {
    void recargar();
  }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = q
      ? clases.filter((c) => c.titulo.toLowerCase().includes(q))
      : clases;
    // Las más próximas arriba: es el orden en el que se trabajan.
    return [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [clases, busqueda]);

  async function eliminar(clase: ClaseEscuela) {
    const ok = await confirm({
      title: "Borrar la clase",
      description: `«${clase.titulo}» desaparecerá del calendario de los alumnos.`,
    });
    if (!ok) return;
    await borrarClase(clase.id);
    void recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar una clase"
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
          <CalendarPlus className="mr-2 h-4 w-4" />
          Nueva clase
        </Button>
      </div>

      {cargando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
      ) : filtradas.length ? (
        <ul className="divide-y rounded-xl border bg-background">
          {filtradas.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{c.titulo}</span>
                  {!c.publicado ? (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <EyeOff className="h-3 w-3" />
                      Oculta
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {fechaLarga(c.fecha)} · {c.horaInicio}
                  {c.horaFin ? ` - ${c.horaFin}` : ""} ·{" "}
                  {TIPOS_CLASE.find((t) => t.valor === c.tipo)?.etiqueta ?? c.tipo}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditando(c);
                  setAbierto(true);
                }}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => eliminar(c)}
                aria-label="Borrar"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todavía no hay ninguna clase apuntada.
        </div>
      )}

      <ClaseDialog
        abierto={abierto}
        clase={editando}
        cursos={cursos}
        onCerrar={() => setAbierto(false)}
        onGuardado={recargar}
      />
      {dialog}
    </div>
  );
}
