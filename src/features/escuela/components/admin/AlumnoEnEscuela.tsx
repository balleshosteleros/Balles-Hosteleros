"use client";

/**
 * Si esta persona es alumna de la escuela, dentro de su ficha de cliente.
 *
 * El alumno y el cliente son la misma persona con dos fichas: casi todos los
 * alumnos ya estaban aquí como clientes antes de matricularse. Esto es la
 * vuelta del enlace que hay en la ficha del alumno, para poder ir de una a otra
 * sin buscar a nadie a mano.
 *
 * Es de la MATRIZ y solo de la matriz: la escuela es del propio software, no de
 * un restaurante. En una empresa cliente ni se pinta ni se pregunta a la base
 * de datos, aunque la ficha de cliente sea la misma vista.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useCatalogoEmpresa } from "@/features/empresa/contexts/catalogo-empresa-context";
import { alumnoDeCliente } from "../../actions/alumnos-actions";

type Alumno = { id: string; nombre: string; email: string; estado: string };

export function AlumnoEnEscuela({ clienteId }: { clienteId: string }) {
  const { esMatriz } = useCatalogoEmpresa();
  // Se guarda de qué cliente es lo que hay en mano: así al abrir otra ficha no
  // se enseña un instante el alumno del cliente anterior.
  const [cargado, setCargado] = useState<{ clienteId: string; alumno: Alumno | null } | null>(null);

  useEffect(() => {
    if (!esMatriz) return;
    let vigente = true;
    alumnoDeCliente(clienteId).then((res) => {
      if (!vigente) return;
      setCargado({ clienteId, alumno: res.alumno ?? null });
    });
    return () => {
      vigente = false;
    };
  }, [clienteId, esMatriz]);

  const alumno = cargado?.clienteId === clienteId ? cargado.alumno : null;
  if (!alumno) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <GraduationCap className="h-3.5 w-3.5 shrink-0" />
        <span>Es alumno de la escuela</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-xs">
        <span className="font-medium text-foreground">{alumno.nombre || alumno.email}</span>
        {alumno.estado === "INACTIVO" ? (
          <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-medium">
            Inactivo
          </Badge>
        ) : null}
        <Link
          href={`/producto/escuela?alumno=${alumno.id}`}
          className="ml-auto shrink-0 font-medium text-primary hover:underline"
        >
          Ver ficha de alumno
        </Link>
      </div>
    </div>
  );
}
