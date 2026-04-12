"use client";

import { useMemo, useState } from "react";
import {
  useCronogramasOperativos,
  CronogramaOperativo,
  Frecuencia,
} from "../../hooks/useCronogramasOperativos";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const ORDERED_FREQUENCIES: Frecuencia[] = [
  "DIARIO",
  "SEMANAL",
  "MENSUAL",
  "TRIMESTRAL",
  "POR NECESIDAD",
];

export function CronogramasView() {
  const { data, isLoading, addTarea, updateTarea, deleteTarea, refresh } = useCronogramasOperativos();
  
  const [selectedRol, setSelectedRol] = useState<string>("");

  // Creación de Rol
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newRolName, setNewRolName] = useState("");

  const rolesDisponibles = useMemo(() => {
    const roles = Array.from(new Set(data.map((d) => d.rol))).filter(Boolean);
    return roles.sort();
  }, [data]);

  const rolActivo = selectedRol || (rolesDisponibles.length > 0 ? rolesDisponibles[0] : "");

  // Tareas filtradas para la tabla en cuestión
  const tareasDeLaTabla = useMemo(() => data.filter((d) => d.rol === rolActivo), [data, rolActivo]);

  // Manejo de edición en línea de la celda de la matriz (como Excel real)
  const [editingCell, setEditingCell] = useState<{ id: string; field: "tarea" | "tiempo_req", freq?: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const procesarEdicionCierre = async () => {
    if (!editingCell) return;
    
    // Si vaciamos el campo por completo o actualizamos algo
    const { id, field } = editingCell;
    const item = tareasDeLaTabla.find(t => t.id === id);
    if (!item) {
      setEditingCell(null);
      return;
    }

    if (field === "tarea") {
      if (editValue.trim() !== item.tarea) {
        await updateTarea(id, { tarea: editValue });
      }
    } else if (field === "tiempo_req") {
      // Estamos editando una frecuencia; la interfaz anterior tenía la frec acoplada al item.
      // Debido a la normalización "un item = una tarea con X frecuencia", 
      // para mutar una tarea hacia otra columna/frecuencia, actualizamos ambos si editValue no está vacío.
      const targetFreq = editingCell.freq as Frecuencia;
      
      if (editValue.trim() === "") {
         // Borrar tiempo ("-") 
         await updateTarea(id, { tiempo_requerido: "", frecuencia: "OTRO" });
      } else {
         await updateTarea(id, { frecuencia: targetFreq, tiempo_requerido: editValue });
      }
    }

    setEditingCell(null);
    setEditValue("");
  };

  const handleCreateEmptyRow = async () => {
    if (!rolActivo) return;
    await addTarea({
      rol: rolActivo,
      tarea: "Nueva tarea (Clic para editar)",
      frecuencia: "OTRO",
      tiempo_requerido: "",
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/20">
      <div className="flex flex-col md:flex-row md:items-center gap-4 px-6 py-4 border-b bg-card">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-1 group">
            <Select 
              value={rolActivo} 
              onValueChange={setSelectedRol}
              disabled={isLoading || rolesDisponibles.length === 0}
            >
              <SelectTrigger className="w-[300px] bg-background">
                <SelectValue placeholder={isLoading ? "Cargando roles..." : "Selecciona Departamento/Rol"} />
              </SelectTrigger>
              <SelectContent>
                {rolesDisponibles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {rolActivo && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all shadow-none"
                onClick={async () => {
                  if (confirm(`¿Estás seguro de que quieres eliminar TODO el cronograma de ${rolActivo}? Esta acción borrará todas sus tareas.`)) {
                    const params = tareasDeLaTabla;
                    for (const t of params) {
                      await deleteTarea(t.id);
                    }
                    setSelectedRol("");
                  }
                }}
                title={`Eliminar cronograma ${rolActivo}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowNewDialog(true)}
            className="md:ml-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            AÑADIR CRONOGRAMA
          </Button>

          {rolActivo && (
            <Button 
              type="button"
              size="sm" 
              onClick={() => {
                handleCreateEmptyRow().catch(console.error);
                setTimeout(() => {
                  const container = document.getElementById('table-scroll-container');
                  if (container) {
                    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
                  }
                }, 200);
              }} 
              className="shadow-sm"
              disabled={isLoading}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Añadir Tarea
            </Button>
          )}
        </div>

      </div>

      {/* PORTAL EXCEL PREMIUM */}
      <div id="table-scroll-container" className="flex-1 p-6 overflow-auto">
        {!rolActivo ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 opacity-20 mb-4" />
            <p className="mb-2">No hay ningún departamento disponible.</p>
          </div>
        ) : (
          <div className="bg-card w-full max-w-7xl mx-auto rounded-xl border shadow-md overflow-hidden">
            {/* Cuadrícula Elegante estilo Excel */}
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[1000px] border-collapse bg-card text-sm">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground uppercase text-xs tracking-wider border-b font-medium">
                    <th className="py-4 px-6 text-left w-[40%] font-semibold border-r">Tarea a ejecutar</th>
                    {ORDERED_FREQUENCIES.map(f => (
                      <th key={f} className="py-4 px-2 text-center w-[12%] font-semibold border-r border-border/50">
                        {f}
                      </th>
                    ))}
                    <th className="py-4 px-3 w-[10%] text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tareasDeLaTabla.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        Sin datos en esta matriz. Añade una tarea.
                      </td>
                    </tr>
                  ) : (
                    tareasDeLaTabla.map((t) => (
                      <tr 
                        key={t.id} 
                        className="group hover:bg-muted/10 transition-colors duration-150 ease-in-out"
                      >
                        {/* CELDA DE LA TAREA */}
                        <td 
                          className="px-6 py-3 border-r relative min-h-[4rem] align-middle cursor-pointer"
                          onClick={() => {
                            setEditingCell({ id: t.id, field: "tarea" });
                            const isDefault = t.tarea.includes("Nueva tarea") || t.tarea.includes("Añadir misión de");
                            setEditValue(isDefault ? "" : t.tarea);
                          }}
                        >
                          {editingCell?.id === t.id && editingCell?.field === "tarea" ? (
                            <Textarea 
                              autoFocus 
                              value={editValue}
                              placeholder="Escribe la tarea aquí..."
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={procesarEdicionCierre}
                              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && procesarEdicionCierre()}
                              className="text-sm bg-background border-primary focus:ring-1 focus:ring-primary h-14 resize-none leading-relaxed"
                            />
                          ) : (
                            <span className="text-foreground/90 font-medium group-hover:text-primary transition-colors pr-2">
                              {t.tarea}
                            </span>
                          )}
                        </td>

                        {/* CELDAS DE FRECUENCIAS */}
                        {ORDERED_FREQUENCIES.map((freq) => {
                          const isActiveFreq = t.frecuencia === freq;
                          const celdaValue = isActiveFreq ? (t.tiempo_requerido || "✓") : "";
                          const isEdicionCell = editingCell?.id === t.id && editingCell?.field === "tiempo_req" && editingCell?.freq === freq;

                          return (
                            <td 
                              key={freq} 
                              className={`px-3 py-3 border-r border-border/40 text-center relative cursor-pointer align-middle transition-colors
                                ${isActiveFreq ? "bg-primary/[0.04]" : "hover:bg-muted/30"}`}
                              onClick={() => {
                                setEditingCell({ id: t.id, field: "tiempo_req", freq });
                                setEditValue(celdaValue === "✓" ? "30 MIN" : celdaValue); 
                              }}
                            >
                              {isEdicionCell ? (
                                <Input
                                  autoFocus
                                  className="h-8 text-center text-xs font-semibold bg-background border-primary focus:ring-1 w-full uppercase"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={procesarEdicionCierre}
                                  onKeyDown={(e) => e.key === "Enter" && procesarEdicionCierre()}
                                  placeholder="Ej: 30 MIN"
                                />
                              ) : (
                                <span className={isActiveFreq ? "font-bold text-primary tracking-widest text-[11px]" : "text-transparent"}>
                                  {celdaValue || "-"}
                                </span>
                              )}
                            </td>
                          );
                        })}

                        {/* CELDA DE BORRADO */}
                        <td className="px-3 py-3 text-center align-middle">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                            onClick={() => deleteTarea(t.id)}
                            title="Eliminar tarea"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* DIALOG CREAR NUEVO CRONOGRAMA */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear un nuevo cronograma</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Introduce el nuevo Departamento/Rol</Label>
            <Input
              value={newRolName}
              onChange={(e) => setNewRolName(e.target.value.toUpperCase())}
              className="mt-2"
              placeholder="Ej. GERENCIA DE BARRA"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (newRolName) {
                // Creamos una row vacía para inicializar ese departamento en la DB
                addTarea({ rol: newRolName, tarea: "Añadir misión de " + newRolName, frecuencia: "OTRO", tiempo_requerido: "" });
                setSelectedRol(newRolName);
                setShowNewDialog(false);
                setNewRolName("");
              }
            }}>Crear Cronograma</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
