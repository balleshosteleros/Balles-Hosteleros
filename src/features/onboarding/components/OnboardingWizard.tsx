"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Briefcase, Users, Truck, Package, Image as ImageIcon,
  BookOpen, CalendarDays, Check, ArrowRight, Lock, PartyPopper,
} from "lucide-react";
import { ONBOARDING_STEPS } from "@/features/onboarding/data/steps";
import {
  marcarPasoIniciado, marcarPasoOmitido, completarOnboarding,
} from "@/features/onboarding/actions/onboarding-actions";
import type { OnboardingResumen, OnboardingEstado } from "@/features/onboarding/types/onboarding";

const ICONOS: Record<string, React.ComponentType<{ className?: string }>> = {
  MapPin, Briefcase, Users, Truck, Package, Image: ImageIcon, BookOpen, CalendarDays,
};

const ESTADO_BADGE: Record<OnboardingEstado, { label: string; clase: string }> = {
  completado: { label: "Completado", clase: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  en_progreso: { label: "En progreso", clase: "bg-amber-100 text-amber-700 border-amber-200" },
  omitido: { label: "Omitido", clase: "bg-muted text-muted-foreground" },
  pendiente: { label: "Pendiente", clase: "bg-muted text-muted-foreground" },
};

export function OnboardingWizard({ initial }: { initial: OnboardingResumen }) {
  const router = useRouter();
  const [resumen] = useState(initial);
  const [pending, startTransition] = useTransition();

  const estadoDe = (key: string): OnboardingEstado =>
    resumen.pasos.find((p) => p.key === key)?.estado ?? "pendiente";
  const countDe = (key: string): number =>
    resumen.pasos.find((p) => p.key === key)?.count ?? 0;

  const irACargar = (key: string, ruta: string) => {
    startTransition(async () => {
      await marcarPasoIniciado(key);
      router.push(ruta);
    });
  };

  const omitir = (key: string) => {
    startTransition(async () => {
      const res = await marcarPasoOmitido(key);
      if (!res.ok) { toast.error(res.error ?? "No se pudo omitir"); return; }
      router.refresh();
    });
  };

  const finalizar = () => {
    startTransition(async () => {
      const res = await completarOnboarding();
      if (!res.ok) { toast.error(res.error ?? "No se pudo finalizar"); return; }
      toast.success("¡Onboarding completado! Tu empresa ya está operativa.");
      router.push("/");
    });
  };

  if (resumen.completadoAt) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-3">
          <PartyPopper className="h-10 w-10 mx-auto text-emerald-600" />
          <h2 className="text-lg font-semibold">Onboarding completado</h2>
          <p className="text-sm text-muted-foreground">
            Tu empresa ya está cargada y operativa. Puedes seguir añadiendo datos desde cada módulo.
          </p>
          <Button onClick={() => router.push("/")}>Ir al inicio</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progreso global */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progreso del onboarding</span>
          <span className="font-semibold">{resumen.progreso}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${resumen.progreso}%` }} />
        </div>
      </div>

      {/* Estructura base sembrada (informativo) */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm text-foreground">
            <span className="font-medium">Estructura base lista.</span> Departamentos, roles y organigrama
            ya vienen configurados de serie. Empieza cargando tus datos:
          </p>
        </CardContent>
      </Card>

      {/* Pasos */}
      {ONBOARDING_STEPS.map((step) => {
        const estado = estadoDe(step.key);
        const count = countDe(step.key);
        const Icono = ICONOS[step.icono] ?? Briefcase;
        const completado = estado === "completado";
        // Dependencias: todas deben estar completadas.
        const depsPendientes = step.dependencias.filter((d) => estadoDe(d) !== "completado");
        const bloqueado = depsPendientes.length > 0 && !completado;
        const badge = ESTADO_BADGE[estado];

        return (
          <Card key={step.key} className={completado ? "border-emerald-200" : undefined}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center ${completado ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                {completado ? <Check className="h-5 w-5" /> : <Icono className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{step.titulo}</h3>
                  {step.obligatorio && <Badge variant="secondary" className="text-[10px]">Obligatorio</Badge>}
                  <Badge variant="outline" className={`text-[10px] ${badge.clase}`}>{badge.label}</Badge>
                  {count > 0 && <span className="text-xs text-muted-foreground">· {count} cargado{count !== 1 ? "s" : ""}</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{step.descripcion}</p>
                {bloqueado && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Antes completa: {step.dependencias.map((d) => ONBOARDING_STEPS.find((s) => s.key === d)?.titulo).join(", ")}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {!completado && !step.obligatorio && estado !== "omitido" && (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => omitir(step.key)}>
                    Omitir
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={completado ? "outline" : "default"}
                  disabled={pending || bloqueado}
                  onClick={() => irACargar(step.key, step.rutaGestion)}
                  className="gap-1.5"
                >
                  {step.volcadoMasivo ? "Volcar plantilla" : completado ? "Revisar" : "Cargar"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Finalizar */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">
          {resumen.obligatoriosCompletos
            ? "Ya tienes lo mínimo para operar. Puedes finalizar o seguir cargando los pasos opcionales."
            : "Completa locales, puestos y empleados para finalizar."}
        </p>
        <Button disabled={pending || !resumen.obligatoriosCompletos} onClick={finalizar}>
          Finalizar onboarding
        </Button>
      </div>
    </div>
  );
}
