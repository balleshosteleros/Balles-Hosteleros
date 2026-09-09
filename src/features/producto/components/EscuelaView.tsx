"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, ExternalLink, GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { useFormacionStore } from "@/features/formacion/store/use-formacion-store";
import { CursosTab } from "@/features/escuela/components/admin/CursosTab";
import { ClasesTab } from "@/features/escuela/components/admin/ClasesTab";
import { AlumnosTab } from "@/features/escuela/components/admin/AlumnosTab";

/**
 * ESCUELA — submódulo de PRODUCTO (empresa matriz).
 *
 * Es el otro lado del portal del alumno: aquí se monta TODO lo que allí se ve
 * —cursos, clases y quién entra— y allí no se puede tocar nada. El botón de
 * arriba abre el portal tal y como lo ve un alumno, sin volver a identificarse.
 */
export function EscuelaView() {
  const { cursos, hydrate } = useFormacionStore();
  const ambitoCargado = useFormacionStore((s) => s.ambito);
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);
  // Se entra aquí desde la ficha de un cliente con `?alumno=<id>`: hay que
  // aterrizar en Alumnos, no en Clases, o el enlace no lleva a ninguna parte.
  const searchParams = useSearchParams();
  const [pestana, setPestana] = useState(searchParams?.get("alumno") ? "alumnos" : "clases");

  useEffect(() => {
    if (ambitoCargado !== "escuela") void hydrate("", { ambito: "escuela" });
  }, [ambitoCargado, hydrate]);

  // Las empresas cliente sirven para saber de qué restaurante es cada alumno.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("empresas").select("id, nombre").order("nombre");
      if (vivo) setEmpresas((data ?? []) as { id: string; nombre: string }[]);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const cursosEscuela = useMemo(
    () =>
      cursos
        .filter((c) => c.ambito === "escuela")
        .map((c) => ({ id: c.id, titulo: c.titulo })),
    [cursos],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 pb-28 md:p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Escuela</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Las clases, los cursos y los alumnos del portal de formación.
          </p>
        </div>
        {/* Se abre en una pestaña nueva: el portal es otro sitio, no una
            pantalla más del software. */}
        <a href="/api/escuela/entrar" target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir el portal
          </Button>
        </a>
      </div>

      <Tabs value={pestana} onValueChange={setPestana}>
        <TabsList>
          <TabsTrigger value="clases">
            <CalendarDays className="mr-2 h-4 w-4" />
            Clases
          </TabsTrigger>
          <TabsTrigger value="cursos">
            <GraduationCap className="mr-2 h-4 w-4" />
            Cursos
          </TabsTrigger>
          <TabsTrigger value="alumnos">
            <Users className="mr-2 h-4 w-4" />
            Alumnos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clases" className="mt-4">
          <ClasesTab cursos={cursosEscuela} />
        </TabsContent>
        <TabsContent value="cursos" className="mt-4">
          <CursosTab />
        </TabsContent>
        <TabsContent value="alumnos" className="mt-4">
          <AlumnosTab cursos={cursosEscuela} empresas={empresas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
