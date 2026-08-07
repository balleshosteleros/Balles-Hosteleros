"use client";

import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { ConfigOperativa } from "@/features/ajustes/data/ajustes";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

const EJEMPLO =
  "Escribimos de tú, cercano pero sin coleguear.\n" +
  "Al grano desde la primera línea, sin rodeos.\n" +
  "Nunca prometemos fechas de entrega sin confirmarlas antes.";

/**
 * Estilo BASE de redacción de correos con IA para toda la empresa.
 * Se guarda en `empresas.config_operativa` (jsonb, sin migración).
 * Cada usuario puede añadir su estilo personal encima desde la propia
 * ventana de correo.
 */
export function EmailRedaccionPanel() {
  const { ajustes, setAjustes } = useEmpresa();
  const c = ajustes.configOperativa;

  const set = (k: keyof ConfigOperativa, v: string) => {
    setAjustes((prev) => ({
      ...prev,
      configOperativa: { ...prev.configOperativa, [k]: v },
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <h3 className="text-sm font-medium text-foreground">
          Redacción de correos con IA
        </h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Define cómo escribe la empresa. Se aplica a todos los correos que
        redacte la IA, sin que nadie tenga que repetirlo cada vez. Cada usuario
        puede añadir su estilo personal desde la ventana de correo.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label className="text-xs font-bold uppercase">Tono</Label>
          <Select
            value={c.emailTonoIA ?? "cercano"}
            onValueChange={(v) => set("emailTonoIA", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cercano">Cercano</SelectItem>
              <SelectItem value="profesional">Profesional</SelectItem>
              <SelectItem value="directo">Directo</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="amistoso">Amistoso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase">Longitud</Label>
          <Select
            value={c.emailLongitudIA ?? "medio"}
            onValueChange={(v) => set("emailLongitudIA", v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="corto">Corto</SelectItem>
              <SelectItem value="medio">Medio</SelectItem>
              <SelectItem value="largo">Largo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs font-bold uppercase">
          Indicaciones de estilo
        </Label>
        <textarea
          value={c.emailEstiloIA ?? ""}
          onChange={(e) => set("emailEstiloIA", e.target.value)}
          placeholder={EJEMPLO}
          rows={5}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Dos o tres frases bastan. Escríbelo como se lo dirías a un empleado
          nuevo: qué tono usar, qué evitar y qué no decir nunca.
        </p>
      </div>
    </div>
  );
}
