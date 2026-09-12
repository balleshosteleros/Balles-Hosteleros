"use client";

/**
 * Formación inicial dentro del portal de Ayuda.
 *
 * Enseña los MISMOS cursos por departamento que la pantalla de Formación —es lo
 * mismo visto desde otro sitio—, filtrados por lo que ve el rol de cada uno.
 */

import { Brain, Compass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CursosDepartamentoGrid } from "./CursosDepartamentoGrid";

export function FormacionRolViewer() {
  return (
    <div className="space-y-8">
      <CursosDepartamentoGrid descripcion="Pulsa cada departamento para abrirlo y recordar cómo funciona." />

      {/* Filosofía Ikigai p. 94 */}
      <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base">
              Filosofía Ikigai · pág. 94 — Fluir en el trabajo
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            En Balles Hosteleros queremos que disfrutes lo que haces. El libro
            del <em>Ikigai</em> describe el estado de <strong>fluir</strong>:
            cuando lo que haces es lo bastante exigente como para retarte, pero
            también lo bastante claro como para no agobiarte.
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
            <li>Una sola tarea cada vez.</li>
            <li>Un objetivo claro antes de empezar.</li>
            <li>Feedback inmediato: si algo va mal, decirlo en el momento.</li>
            <li>Reto justo: ni demasiado fácil, ni imposible.</li>
          </ul>
        </CardContent>
      </Card>

      {/* Filosofía Ikigai p. 102 */}
      <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">
              Filosofía Ikigai · pág. 102 — La concentración como hábito
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            La calidad del servicio depende de la atención plena. Cuando estás
            en la sala, estás <strong>en la sala</strong>. Cuando elaboras un
            plato, estás <strong>en el plato</strong>.
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
            <li>Móvil personal fuera del puesto durante el servicio.</li>
            <li>Cuida pequeñas señales: el detalle es lo que el cliente recuerda.</li>
            <li>Respira antes de cada tarea importante. Tres segundos.</li>
            <li>Cuando termines, pasa a la siguiente tarea con foco renovado.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
