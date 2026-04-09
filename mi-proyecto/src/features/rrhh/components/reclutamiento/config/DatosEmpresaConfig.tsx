import { useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Link2 } from "lucide-react";

export function DatosEmpresaConfig() {
  const { empresaActual } = useEmpresa();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Datos de tu empresa</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Información que se mostrará en el portal de empleo y en las comunicaciones con candidatos
        </p>
      </div>

      {/* Datos básicos */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Información general</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Nombre comercial</Label>
              <Input defaultValue={empresaActual.nombre} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">CIF / NIF</Label>
              <Input placeholder="B12345678" />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Descripción de la empresa</Label>
            <Textarea placeholder="Describe brevemente tu empresa..." className="min-h-[80px]" />
          </div>
        </CardContent>
      </Card>

      {/* Contacto */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Contacto</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Email de contacto</Label>
              <Input placeholder="rrhh@empresa.com" type="email" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Teléfono</Label>
              <Input placeholder="+34 600 000 000" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Dirección</Label>
              <Input placeholder="Calle ejemplo, 1" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Ciudad</Label>
              <Input placeholder="Madrid" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo e imagen */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Identidad visual</h3>
        </div>
        <CardContent className="p-5">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Logo de la empresa</Label>
              <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                <div className="text-center">
                  <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground">Subir logo</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7">Cambiar</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive">Eliminar</Button>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Imagen corporativa / Portada</Label>
              <div className="w-full h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                <div className="text-center">
                  <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <span className="text-[10px] text-muted-foreground">Subir imagen</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7">Cambiar</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive">Eliminar</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enlaces */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Enlaces</h3>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Sitio web", placeholder: "https://www.tuempresa.com" },
            { label: "LinkedIn", placeholder: "https://linkedin.com/company/..." },
            { label: "Instagram", placeholder: "https://instagram.com/..." },
            { label: "Facebook", placeholder: "https://facebook.com/..." },
          ].map((link) => (
            <div key={link.label} className="flex items-center gap-3">
              <Label className="text-sm text-foreground w-24 shrink-0">{link.label}</Label>
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder={link.placeholder} className="pl-9" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Guardar cambios</Button>
      </div>
    </div>
  );
}
