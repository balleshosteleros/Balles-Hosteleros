"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Database, Plug, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getAgoraIntegracion,
  guardarAgoraIntegracion,
  probarConexionAgora,
} from "@/features/ajustes/actions/agora-integracion-actions";

/**
 * Integraciones de la empresa con servicios externos (PRP-059).
 * Cada empresa configura aquí sus propias claves de Ágora POS.
 */
export function IntegracionesTab() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id;

  const [cargando, setCargando] = useState(true);
  const [activo, setActivo] = useState(false);
  const [url, setUrl] = useState("");
  const [workplaceId, setWorkplaceId] = useState("");
  const [token, setToken] = useState("");
  const [tieneToken, setTieneToken] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    getAgoraIntegracion().then((res) => {
      if (!vivo) return;
      if (res.ok) {
        setActivo(res.estado.activo);
        setUrl(res.estado.url);
        setWorkplaceId(res.estado.workplaceId != null ? String(res.estado.workplaceId) : "");
        setTieneToken(res.estado.tieneToken);
        setToken("");
      }
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [empresaId]);

  const probar = async () => {
    setProbando(true);
    const res = await probarConexionAgora({
      url,
      workplaceId: workplaceId ? Number(workplaceId) : 0,
      token: token || undefined,
    });
    setProbando(false);
    if (res.ok) {
      toast.success(`Conexión correcta — ${res.facturas} factura(s) de ayer (${res.dia}).`);
    } else {
      toast.error(res.error);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    const res = await guardarAgoraIntegracion({
      activo,
      url,
      workplaceId: workplaceId ? Number(workplaceId) : null,
      token: token || undefined,
    });
    setGuardando(false);
    if (res.ok) {
      toast.success("Integración de Ágora guardada.");
      if (token) {
        setTieneToken(true);
        setToken("");
      }
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Integraciones</h2>
        <p className="text-sm text-muted-foreground">
          Conecta tu empresa con servicios externos. Cada empresa gestiona sus
          propias claves; afectan solo a la empresa activa del selector.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Database className="h-5 w-5 text-emerald-600" />
            Ágora POS
            {activo ? (
              <Badge className="ml-auto gap-1 bg-emerald-100 font-normal text-emerald-700 hover:bg-emerald-100">
                <CheckCircle2 className="h-3 w-3" /> Activo
              </Badge>
            ) : (
              <Badge variant="secondary" className="ml-auto font-normal">
                Inactivo
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Plug className="mt-0.5 h-4 w-4 shrink-0" />
            Sincroniza automáticamente las ventas cerradas de tu TPV Ágora cada
            día. Introduce tus datos, prueba la conexión y guárdalos.
          </p>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-foreground">Conector activo</div>
              <div className="text-xs text-muted-foreground">
                Cuando está activo, el sistema importa tus ventas cada madrugada.
              </div>
            </div>
            <Switch checked={activo} onCheckedChange={setActivo} disabled={cargando} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="agora-url">Dirección del servicio</Label>
              <Input
                id="agora-url"
                placeholder="https://tu-servidor-agora.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={cargando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agora-tpv">Nº de TPV</Label>
              <Input
                id="agora-tpv"
                inputMode="numeric"
                placeholder="Ej. 4"
                value={workplaceId}
                onChange={(e) => setWorkplaceId(e.target.value.replace(/[^0-9]/g, ""))}
                disabled={cargando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agora-token">Token de Ágora</Label>
              <Input
                id="agora-token"
                type="password"
                autoComplete="off"
                placeholder={tieneToken ? "•••••••• (guardado)" : "Pega aquí tu token"}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={cargando}
              />
              <p className="text-xs text-muted-foreground">
                {tieneToken
                  ? "Déjalo vacío para mantener el token actual."
                  : "Se guarda cifrado y no se vuelve a mostrar."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button variant="outline" onClick={probar} disabled={probando || cargando || !url || !workplaceId}>
              {probando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Probar conexión
            </Button>
            <Button onClick={guardar} disabled={guardando || cargando}>
              {guardando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
