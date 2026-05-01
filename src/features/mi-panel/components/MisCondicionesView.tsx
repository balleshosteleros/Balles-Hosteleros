"use client";

import { FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { SubpageHeader } from "./SubpageHeader";

interface Field {
  label: string;
  value: string;
}

export function MisCondicionesView() {
  const { profile, user, roles } = useAuth();
  const nombre = [profile?.nombre, profile?.apellidos].filter(Boolean).join(" ") || "—";
  const email = profile?.email || user?.email || "—";
  const rolesLabel = roles.length ? roles.join(", ") : "—";

  const datosLaborales: Field[] = [
    { label: "Nombre", value: nombre },
    { label: "Email", value: email },
    { label: "Rol(es)", value: rolesLabel },
  ];

  const condiciones: Field[] = [
    { label: "Tipo de contrato", value: "Pendiente de configurar" },
    { label: "Jornada", value: "Pendiente de configurar" },
    { label: "Categoría profesional", value: "Pendiente de configurar" },
    { label: "Salario base", value: "Pendiente de configurar" },
    { label: "Fecha de alta", value: "Pendiente de configurar" },
    { label: "Convenio aplicable", value: "Pendiente de configurar" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <SubpageHeader
        title="Condiciones"
        subtitle="Tus datos laborales y condiciones contractuales"
        icon={FileText}
      />

      <Card className="p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Datos personales
        </h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {datosLaborales.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm font-medium mt-0.5">{f.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-4 md:p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Condiciones laborales
        </h2>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {condiciones.map((f) => (
            <div key={f.label}>
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm font-medium mt-0.5 text-muted-foreground/70">
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-[11px] text-muted-foreground mt-4 border-t pt-3">
          Las condiciones contractuales completas se mostrarán cuando RRHH publique tu ficha laboral.
        </p>
      </Card>
    </div>
  );
}
