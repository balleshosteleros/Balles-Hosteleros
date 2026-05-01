"use client";

import { GraduationCap, ExternalLink, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { SubpageHeader } from "./SubpageHeader";

export function MiFormacionView() {
  const { roles } = useAuth();
  const rolPrincipal = roles[0] ?? "empleado";

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <SubpageHeader
        title="Formación"
        subtitle="Tu ruta formativa y módulos de aprendizaje"
        icon={GraduationCap}
      />

      <Card className="p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base">Portal formativo</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Accede a los módulos formativos asignados a tu rol
              <span className="font-medium text-foreground"> {rolPrincipal}</span>:
              videos, manuales y evaluaciones.
            </p>
            <Button variant="primary" size="lg" className="mt-4" disabled>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir portal formativo
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2">
              El portal estará disponible cuando RRHH publique tu ruta formativa.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
