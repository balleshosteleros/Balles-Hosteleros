"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getReclutamientoConfig, saveReclutamientoConfig } from "@/features/rrhh/actions/gestoria-actions";

export function GestoriaConfig({ embedded = false }: { embedded?: boolean } = {}) {
  const [email, setEmail] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getReclutamientoConfig().then((r) => {
      setEmail(r.data.gestoria_email);
      setEmailCc(r.data.gestoria_email_cc);
      setLoading(false);
    });
  }, []);

  const guardar = async () => {
    setSaving(true);
    try {
      const res = await saveReclutamientoConfig({ gestoria_email: email, gestoria_email_cc: emailCc });
      if (res.ok) toast.success("Configuración guardada");
      else toast.error(res.error ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-muted-foreground py-8"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }

  const cuerpo = (
    <div className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <Label htmlFor="gest-email">Email de la gestoría</Label>
        <Input id="gest-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="gestoria@asesoria.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gest-email-cc">Segundo contacto (opcional)</Label>
        <Input id="gest-email-cc" type="email" value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="otro.contacto@asesoria.com" />
      </div>
      <Button onClick={guardar} disabled={saving}>
        {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…</> : "Guardar"}
      </Button>
    </div>
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Correos de la gestoría</h3>
          <p className="text-xs text-muted-foreground">
            Al contratar a un candidato, el alta de contrato se envía a estos correos.
            No se vinculan a ningún departamento ni persona.
          </p>
        </div>
        {cuerpo}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Correos de la gestoría</CardTitle>
        <CardDescription>
          Al contratar a un candidato, el alta de contrato se envía a estos correos.
          No se vinculan a ningún departamento ni persona.
        </CardDescription>
      </CardHeader>
      <CardContent>{cuerpo}</CardContent>
    </Card>
  );
}
