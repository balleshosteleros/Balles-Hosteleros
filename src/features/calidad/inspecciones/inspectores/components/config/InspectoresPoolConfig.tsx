"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CAMPOS_FIJOS = [
  "Nombre y apellidos",
  "Teléfono",
  "Email",
  "Ciudad",
  "Disponibilidad horaria",
  "Vehículo propio",
];

export function InspectoresPoolConfig() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Inspectores</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Datos del perfil de inspector
        </p>
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">
            Campos del perfil
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Todos los inspectores guardan los mismos datos, tanto desde la
            bolsa pública como desde el alta manual.
          </p>
        </div>
        <CardContent className="p-0">
          {CAMPOS_FIJOS.map((label) => (
            <div
              key={label}
              className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0"
            >
              <span className="text-sm text-foreground">{label}</span>
              <Badge variant="secondary" className="text-[10px]">
                Obligatorio
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
