import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, ChevronRight, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  FASES_PRINCIPALES_ORDER,
  FASES_PRINCIPALES,
  ESTADOS_CONFIG,
  TIPO_JORNADA_LABELS,
} from "@/features/rrhh/data/reclutamiento";

export function OfertasTrabajoConfig() {
  const categorias = ["Sala", "Dirección", "Entretenimiento", "Operaciones", "Administración"];
  const ubicaciones = ["La Habana — Sala principal", "La Habana — Terraza", "La Habana — Planta baja", "Bacanal — Central", "Bacanal — Sala VIP", "Bacanal — Oficina"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Ofertas de trabajo</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura categorías, tipos de jornada, ubicaciones y fases del proceso de selección
        </p>
      </div>

      {/* Categorías */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Categorías de puestos</h3>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        <CardContent className="p-0">
          {categorias.map((item) => (
            <div key={item} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tipos de jornada */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Tipos de jornada</h3>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        <CardContent className="p-0">
          {Object.entries(TIPO_JORNADA_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <span className="text-sm text-foreground">{label}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Ubicaciones */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">Ubicaciones</h3>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Añadir
          </Button>
        </div>
        <CardContent className="p-0">
          {ubicaciones.map((item) => (
            <div key={item} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                <span className="text-sm text-foreground">{item}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Fases y estados */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Fases y estados del proceso</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Estructura jerárquica del pipeline de selección</p>
        </div>
        <CardContent className="p-5 space-y-3">
          {FASES_PRINCIPALES_ORDER.map((fp) => {
            const cfg = FASES_PRINCIPALES[fp];
            return (
              <div key={fp} className="rounded-lg border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: `linear-gradient(90deg, ${cfg.colorFrom}15, ${cfg.colorTo}08)` }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-sm font-semibold text-foreground">{cfg.label}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{cfg.estados.length} estados</Badge>
                </div>
                <div className="px-4 py-2 space-y-1">
                  {cfg.estados.map((est) => (
                    <div key={est} className="flex items-center gap-2 py-1.5 pl-4 text-sm text-muted-foreground">
                      <ChevronRight className="h-3 w-3" />
                      <span>{ESTADOS_CONFIG[est].label}</span>
                      <span className="text-xs">{ESTADOS_CONFIG[est].icono}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Cuestionarios */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground text-sm">Cuestionarios</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Formularios adicionales para candidatos al inscribirse</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Crear cuestionario
          </Button>
        </div>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No hay cuestionarios configurados
        </CardContent>
      </Card>
    </div>
  );
}
