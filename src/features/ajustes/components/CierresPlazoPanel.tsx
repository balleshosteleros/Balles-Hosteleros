"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getCierresConfig, updateCierresConfig } from "@/features/gerencia/actions/cierres-actions";
import { loadRolesFromSupabase } from "@/features/ajustes/actions/roles-actions";
import { DIAS_BLOQUEO_DEFAULT } from "@/features/gerencia/types/cierres";

/**
 * Plazo para apuntar en Cierres. Vive en Ajustes → Departamentos → Gerencia →
 * submódulo "Cierres" porque es una norma de empresa (nivel superior), no un
 * ajuste de uso diario del módulo. Solo dirección puede cambiarlo: el servidor
 * lo verifica, esta pantalla solo lo presenta.
 *
 * `embedded` quita el marco propio para encajar en la fila del submódulo.
 */
export function CierresPlazoPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const [dias, setDias] = useState<number>(DIAS_BLOQUEO_DEFAULT);
  const [rolExcepcion, setRolExcepcion] = useState<string | null>(null);
  const [modo, setModo] = useState<"fijo" | "libre">("libre");
  const [diaSemana, setDiaSemana] = useState<number | null>(null);
  const [roles, setRoles] = useState<Array<{ id: string; nombre: string }>>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([getCierresConfig(), loadRolesFromSupabase()]).then(([cfg, rs]) => {
      if (!activo) return;
      if (cfg.ok) {
        setDias(cfg.data.dias_bloqueo);
        setRolExcepcion(cfg.data.rol_excepcion_id);
        // El día de cierre no se toca aquí, pero hay que reenviarlo al guardar
        // para no machacarlo (el guardado escribe la fila entera).
        setModo(cfg.data.modo);
        setDiaSemana(cfg.data.dia_semana);
      }
      if (rs) setRoles(rs.map((r) => ({ id: r.id, nombre: r.nombre })));
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, []);

  async function guardar() {
    setGuardando(true);
    const res = await updateCierresConfig({
      modo,
      dia_semana: diaSemana,
      dias_bloqueo: dias,
      // Sin bloqueo no hay excepción que guardar.
      rol_excepcion_id: dias > 0 ? rolExcepcion : null,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar el plazo para apuntar.");
      return;
    }
    toast.success("Plazo para apuntar guardado.");
  }

  return (
    <div className={embedded ? "space-y-5" : "rounded-lg border bg-card p-4 md:p-6 space-y-5 max-w-2xl"}>
      <div className="flex items-start gap-2.5">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">Plazo para apuntar</h3>
          <p className="text-sm text-muted-foreground">
            Días de retraso admitidos para registrar un apunte en Cierres (cierre, retirada o
            ingreso). Pasado ese plazo, nadie puede apuntar con fecha atrasada salvo dirección.
          </p>
        </div>
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <>
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={365}
                step={1}
                className="w-24"
                value={String(dias)}
                onChange={(e) => setDias(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
              />
              <span className="text-sm text-muted-foreground">
                {dias === 0
                  ? "Sin bloqueo: se puede apuntar con cualquier fecha."
                  : `Días de retraso permitidos (${dias === 1 ? "1 día" : `${dias} días`}).`}
              </span>
            </div>

            {dias > 0 && (
              <div className="pt-1">
                <Label className="text-sm">Además de dirección, puede saltarse el plazo</Label>
                <Select
                  value={rolExcepcion ?? "ninguno"}
                  onValueChange={(v) => setRolExcepcion(v === "ninguno" ? null : v)}
                >
                  <SelectTrigger className="w-[260px] mt-1.5">
                    <SelectValue placeholder="Solo dirección" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Solo dirección</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Dirección siempre puede apuntar fuera de plazo, esté o no elegido aquí.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
