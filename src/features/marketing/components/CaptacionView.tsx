"use client";

import {
  UserPlus,
  Megaphone,
  MousePointerClick,
  Users2,
  Eye,
  TrendingUp,
  Sparkles,
  Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const metricas = [
  {
    label: "Impresiones",
    valor: "0",
    delta: "Últimos 30 días",
    icon: Eye,
    color: "text-cyan-600",
  },
  {
    label: "Visitantes únicos",
    valor: "0",
    delta: "Web + landings",
    icon: Users2,
    color: "text-blue-600",
  },
  {
    label: "Leads captados",
    valor: "0",
    delta: "Reservas + formularios",
    icon: UserPlus,
    color: "text-emerald-600",
  },
  {
    label: "Coste por lead",
    valor: "—",
    delta: "Pendiente conectar Meta",
    icon: TrendingUp,
    color: "text-orange-600",
  },
];

const canales = [
  {
    nombre: "Meta Ads (Instagram + Facebook)",
    estado: "Pendiente",
    descripcion:
      "Crear portfolio en Meta y enlazar las dos empresas del holding para que la publicidad crezca la cuenta.",
    icon: Megaphone,
  },
  {
    nombre: "Google Business Profile",
    estado: "Activo",
    descripcion:
      "Reseñas, llamadas, indicaciones cómo llegar y reservas desde la búsqueda local.",
    icon: Globe,
  },
  {
    nombre: "Web pública",
    estado: "Activo",
    descripcion:
      "Carta, reservas y formulario de contacto. Punto de entrada principal del cliente nuevo.",
    icon: MousePointerClick,
  },
];

export function CaptacionView() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-600/10 p-2 text-cyan-600">
            <UserPlus className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">CAPTACIÓN</h1>
            <p className="text-sm text-muted-foreground">
              Métricas y canales para atraer clientes nuevos al holding
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
          En diseño
        </Badge>
      </div>

      {/* Métricas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricas.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </p>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">{m.valor}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Canales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Canales de captación</CardTitle>
            <Sparkles className="h-4 w-4 text-cyan-600" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {canales.map((c) => (
            <div
              key={c.nombre}
              className="flex items-start justify-between gap-3 rounded-lg border p-4"
            >
              <div className="flex items-start gap-3">
                <c.icon className="mt-1 h-4 w-4 text-cyan-600" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.nombre}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.descripcion}
                  </p>
                </div>
              </div>
              <Badge
                variant={c.estado === "Activo" ? "default" : "outline"}
                className="text-[10px] shrink-0"
              >
                {c.estado}
              </Badge>
            </div>
          ))}
          <div className="pt-2">
            <p className="mb-1 text-xs text-muted-foreground">Avance del módulo</p>
            <Progress value={20} className="h-1.5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
