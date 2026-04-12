"use client";

import {
  Gift,
  QrCode,
  TrendingUp,
  Users,
  Ticket,
  Smartphone,
  Bell,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const metricas = [
  {
    label: "Clientes fidelizados",
    valor: "0",
    delta: "+0% vs mes anterior",
    icon: Users,
    color: "text-pink-600",
  },
  {
    label: "Visitas registradas (QR)",
    valor: "0",
    delta: "Este mes",
    icon: QrCode,
    color: "text-violet-600",
  },
  {
    label: "Recompensas canjeadas",
    valor: "0",
    delta: "Total acumulado",
    icon: Gift,
    color: "text-amber-600",
  },
  {
    label: "Ticket medio fidelizados",
    valor: "—",
    delta: "Frente a 0 € no fidelizados",
    icon: TrendingUp,
    color: "text-emerald-600",
  },
];

const programas = [
  {
    titulo: "Ticket de menú gratis cada 10 visitas",
    descripcion:
      "El cliente acumula visitas escaneando el QR del ticket. Al llegar a 10, recibe un menú gratis.",
    estado: "Borrador",
  },
  {
    titulo: "Descuento 10% al gastar 200 €",
    descripcion:
      "Se activa automáticamente cuando el cliente supera el umbral de gasto en el periodo elegido.",
    estado: "Borrador",
  },
  {
    titulo: "Acceso a ofertas exclusivas",
    descripcion:
      "Los clientes fidelizados ven una sección de ofertas reservadas solo para ellos.",
    estado: "Borrador",
  },
];

export function FidelizacionView() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-end">
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

      {/* Cómo funciona */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4">
            <QrCode className="h-5 w-5 text-pink-600" />
            <p className="mt-2 text-sm font-semibold">1 · Escanea el ticket</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada ticket de venta lleva un QR. El cliente lo escanea con el móvil.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <Smartphone className="h-5 w-5 text-violet-600" />
            <p className="mt-2 text-sm font-semibold">2 · Accede a su perfil</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Web interactiva con sus visitas, gasto acumulado y ofertas exclusivas.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <Bell className="h-5 w-5 text-amber-600" />
            <p className="mt-2 text-sm font-semibold">3 · Recibe recompensas</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Avisos automáticos cuando llega a un umbral, recordatorios y premios.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Programas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Programas activos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {programas.map((p) => (
            <div
              key={p.titulo}
              className="flex items-start justify-between gap-3 rounded-lg border p-4"
            >
              <div className="flex items-start gap-3">
                <Ticket className="mt-1 h-4 w-4 text-pink-600" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.descripcion}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {p.estado}
              </Badge>
            </div>
          ))}
          <div className="pt-2">
            <p className="mb-1 text-xs text-muted-foreground">Avance del módulo</p>
            <Progress value={15} className="h-1.5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
