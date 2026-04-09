"use client";

import { HelpCircle } from "lucide-react";
import { AyudaChat } from "@/features/ajustes/components/ayuda/AyudaChat";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAyuda } from "@/features/ajustes/contexts/ayuda-context";
import { Label } from "@/components/ui/label";

const ROLES_SIMULADOS = [
  "Administrador", "Gerencia", "Contabilidad", "Gestoría", "Jurídico",
  "Recursos Humanos", "Logística", "Marketing", "Solo lectura",
];

export default function AyudaPage() {
  const { currentUserRol, setCurrentUserRol } = useAyuda();

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HelpCircle className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">AYUDA</h1>
            <p className="text-sm text-muted-foreground">Centro de ayuda inteligente</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Simular rol:</Label>
          <Select value={currentUserRol} onValueChange={setCurrentUserRol}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES_SIMULADOS.map((r) => (
                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        <AyudaChat />
      </Card>
    </div>
  );
}
