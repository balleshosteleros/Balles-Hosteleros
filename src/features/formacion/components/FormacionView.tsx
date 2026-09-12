"use client";

import {
  Brain,
  Compass,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CursosDepartamentoGrid } from "./CursosDepartamentoGrid";

export function FormacionView() {
  return (
    <div className="space-y-8">
      {/* Bienvenida — qué es esta página */}
      <Card className="border-blue-600/30 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <Sparkles className="h-4 w-4" />
            Bienvenido a Balles Hosteleros
          </div>
          <p className="text-base text-foreground">
            Tu formación dentro de la empresa empieza por <strong>recorrer
            esta web interactiva</strong>. Cada apartado del menú lateral
            corresponde a un área del negocio: léelo, navega tranquilo y
            entenderás cómo funcionamos.
          </p>
          <p className="text-sm text-muted-foreground">
            No tienes que memorizar nada. Tómate tu tiempo, ve módulo por
            módulo y vuelve aquí siempre que necesites repasar.
          </p>
        </CardContent>
      </Card>

      <CursosDepartamentoGrid />

      {/* Ikigai p. 94 — Fluir en el trabajo */}
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
            también lo bastante claro como para no agobiarte. Ese punto medio
            es donde se trabaja a gusto y se rinde de verdad.
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
            <li>Una sola tarea cada vez. Sin saltar de WhatsApp al servicio.</li>
            <li>Un objetivo claro: saber qué tienes que terminar antes de empezar.</li>
            <li>Feedback inmediato: si algo va mal, decirlo en el momento.</li>
            <li>Reto justo: ni demasiado fácil (te aburres), ni imposible (te frustras).</li>
          </ul>
          <p className="text-muted-foreground">
            Si en algún momento sientes que no fluyes, habla con tu responsable.
            Reorganizar tu turno o tu carga es parte del trabajo de la empresa.
          </p>
        </CardContent>
      </Card>

      {/* Ikigai p. 102 — Concentración */}
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
            plato, estás <strong>en el plato</strong>. Concentrarte no es ir
            más rápido: es <em>hacerlo bien a la primera</em>.
          </p>
          <ul className="list-inside list-disc space-y-1 pl-2 text-muted-foreground">
            <li>Móvil personal fuera del puesto durante el servicio.</li>
            <li>Cuida pequeñas señales: el detalle es lo que el cliente recuerda.</li>
            <li>Respira antes de cada tarea importante. Tres segundos.</li>
            <li>Cuando termines, levanta la cabeza y pasa a la siguiente con foco renovado.</li>
          </ul>
        </CardContent>
      </Card>

    </div>
  );
}
