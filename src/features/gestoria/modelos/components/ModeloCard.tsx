"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { PLAZOS_PRESENTACION, periodoALabel } from "../types/modelos";
import type { ModeloAeat } from "../types/modelos";

const HOY = new Date();

function diasHastaPlazo(modelo: ModeloAeat): number | null {
  const plazo = PLAZOS_PRESENTACION[modelo.tipo][modelo.periodo];
  if (!plazo) return null;
  const año = modelo.periodo === "Q4" ? modelo.ejercicio + 1 : modelo.ejercicio;
  const añoPlazo = modelo.periodo === "ANUAL" ? modelo.ejercicio + 1 : año;
  const fin = new Date(añoPlazo, plazo.mes - 1, plazo.dia);
  const diff = Math.ceil((fin.getTime() - HOY.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

function estadoColor(estado: string): string {
  if (estado === "PRESENTADO") return "bg-green-100 text-green-800 border-green-200";
  if (estado === "REVISADO") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-amber-100 text-amber-800 border-amber-200";
}

export function ModeloCard({ modelo }: { modelo: ModeloAeat }) {
  const dias = diasHastaPlazo(modelo);
  const urgente = dias !== null && dias <= 7 && dias >= 0 && modelo.estado !== "PRESENTADO";
  const vencido = dias !== null && dias < 0 && modelo.estado !== "PRESENTADO";
  const resultado =
    (modelo.casillas?.["69"] as number | undefined) ??
    (modelo.casillas?.["19"] as number | undefined) ??
    (modelo.casillas?.["28"] as number | undefined) ??
    (modelo.casillas?.["06"] as number | undefined) ??
    (modelo.casillas?.["660"] as number | undefined);

  return (
    <Link href={`/gestoria/modelos/${modelo.id}`} className="block">
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Modelo {modelo.tipo}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {periodoALabel(modelo.periodo, modelo.ejercicio)}
              </p>
            </div>
            {modelo.estado === "PRESENTADO" ? (
              <Lock className="h-4 w-4 text-green-600" />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={estadoColor(modelo.estado)}>
              {modelo.estado}
            </Badge>
            {urgente ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Cierra en {dias}d
              </Badge>
            ) : null}
            {vencido ? (
              <Badge variant="destructive" className="gap-1">
                Vencido
              </Badge>
            ) : null}
            {modelo.estado === "REVISADO" ? (
              <Badge variant="outline" className="gap-1 bg-blue-50">
                <CheckCircle2 className="h-3 w-3" />
                Listo
              </Badge>
            ) : null}
          </div>

          {resultado !== undefined && resultado !== 0 ? (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">Resultado</p>
              <p
                className={`text-lg font-bold ${
                  resultado > 0 ? "text-red-600" : "text-green-600"
                }`}
              >
                {resultado > 0 ? "A ingresar" : "A devolver/compensar"}:{" "}
                {Math.abs(resultado).toLocaleString("es-ES", {
                  style: "currency",
                  currency: "EUR",
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Sin calcular</p>
          )}

          {modelo.ia_corrida_en ? (
            <p className="text-xs text-muted-foreground">
              IA ejecutada: {new Date(modelo.ia_corrida_en).toLocaleString("es-ES")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
