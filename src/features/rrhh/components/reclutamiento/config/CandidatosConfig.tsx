"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { OrigenesCandidatoConfig } from "./OrigenesCandidatoConfig";
import {
  getCamposFormularioCandidatura,
  saveCamposFormularioCandidatura,
} from "@/features/rrhh/actions/gestoria-actions";
import {
  CAMPOS_FIJOS,
  CAMPOS_CONFIGURABLES,
  normalizarCamposFormulario,
  type CamposFormularioConfig,
  type CampoCandidaturaClave,
} from "@/features/rrhh/data/campos-candidatura";

export function CandidatosConfig() {
  const [campos, setCampos] = useState<CamposFormularioConfig>(() => normalizarCamposFormulario(null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    void getCamposFormularioCandidatura().then((res) => {
      if (!cancel) {
        setCampos(res.data);
        setLoading(false);
      }
    });
    return () => { cancel = true; };
  }, []);

  // Persiste un patch optimista; revierte si el guardado falla.
  const persistir = async (next: CamposFormularioConfig, prev: CamposFormularioConfig) => {
    const res = await saveCamposFormularioCandidatura(next);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      setCampos(prev);
    }
  };

  const toggleActivo = (clave: CampoCandidaturaClave) => {
    setCampos((prev) => {
      const activo = !prev[clave].activo;
      // Si se desactiva el campo, dejar de exigirlo (no puede ser obligatorio si no se muestra).
      const next: CamposFormularioConfig = {
        ...prev,
        [clave]: { activo, obligatorio: activo ? prev[clave].obligatorio : false },
      };
      void persistir(next, prev);
      return next;
    });
  };

  const toggleObligatorio = (clave: CampoCandidaturaClave) => {
    setCampos((prev) => {
      if (!prev[clave].activo) return prev; // un campo oculto no puede ser obligatorio
      const next: CamposFormularioConfig = {
        ...prev,
        [clave]: { ...prev[clave], obligatorio: !prev[clave].obligatorio },
      };
      void persistir(next, prev);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Candidatos</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configura los campos del formulario de candidatura
        </p>
      </div>

      {/* Campos del formulario */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Campos del formulario de candidatura</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Activa los campos que verá el candidato y marca cuáles son obligatorios
          </p>
        </div>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <>
              {/* Campos fijos: siempre activos y obligatorios, no editables */}
              {CAMPOS_FIJOS.map((c) => (
                <div
                  key={c.clave}
                  className="flex items-center justify-between px-5 py-3 border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm text-foreground">{c.label}</span>
                    <Badge variant="secondary" className="text-[10px]">Obligatorio</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground/60">
                    <Lock className="h-3.5 w-3.5" />
                    <Switch checked disabled />
                  </div>
                </div>
              ))}

              {/* Campos configurables: activo + obligatorio */}
              {CAMPOS_CONFIGURABLES.map((c) => {
                const cfg = campos[c.clave];
                return (
                  <div
                    key={c.clave}
                    className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm ${cfg.activo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {c.label}
                      </span>
                      {cfg.activo && (
                        <button
                          type="button"
                          onClick={() => toggleObligatorio(c.clave)}
                          title={cfg.obligatorio ? "Marcar como opcional" : "Marcar como obligatorio"}
                        >
                          <Badge
                            variant={cfg.obligatorio ? "secondary" : "outline"}
                            className="text-[10px] cursor-pointer"
                          >
                            {cfg.obligatorio ? "Obligatorio" : "Opcional"}
                          </Badge>
                        </button>
                      )}
                    </div>
                    <Switch checked={cfg.activo} onCheckedChange={() => toggleActivo(c.clave)} />
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* ¿Por dónde nos has conocido? — orígenes configurables (BD) */}
      <OrigenesCandidatoConfig />

      {/* Permisos de visualización */}
      <Card>
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">Permisos de visualización</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Quién puede ver información de los candidatos</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {[
            { label: "Reclutadores pueden ver todos los candidatos", checked: true },
            { label: "Directores ven datos sensibles (email, teléfono)", checked: true },
            { label: "Otros departamentos pueden consultar candidatos", checked: false },
          ].map((perm) => (
            <div key={perm.label} className="flex items-center justify-between">
              <Label className="text-sm text-foreground">{perm.label}</Label>
              <Switch checked={perm.checked} disabled />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
