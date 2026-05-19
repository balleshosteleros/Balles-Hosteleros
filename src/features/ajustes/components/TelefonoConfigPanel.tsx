"use client";

import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  TelefoniaConfig,
  TelefoniaProveedor,
} from "@/features/ajustes/data/ajustes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Phone, Info, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

const PROVEEDORES: { id: TelefoniaProveedor; label: string; desc: string }[] = [
  {
    id: "none",
    label: "Sin configurar",
    desc: "Las llamadas desde el sistema están desactivadas.",
  },
  {
    id: "b2com_sip",
    label: "B2COM (SIP)",
    desc: "Aprovecha tu línea contratada con B2COM. Sin coste extra por minuto.",
  },
  {
    id: "sip",
    label: "SIP genérico",
    desc: "Cualquier otro operador que te dé credenciales SIP (Fonvirtual, Netelip…).",
  },
  {
    id: "twilio",
    label: "Twilio",
    desc: "Alternativa global. Pago por minuto.",
  },
];

export function TelefonoConfigPanel() {
  const { ajustes, setAjustes, empresaActual } = useEmpresa();
  const t = ajustes.telefonia;

  const set = <K extends keyof TelefoniaConfig>(
    key: K,
    value: TelefoniaConfig[K],
  ) => {
    setAjustes((prev) => ({
      ...prev,
      telefonia: { ...prev.telefonia, [key]: value },
    }));
  };

  const conectado = t.proveedor !== "none";
  const necesitaSip = t.proveedor === "b2com_sip" || t.proveedor === "sip";
  const necesitaTwilio = t.proveedor === "twilio";

  return (
    <div className="space-y-5 py-2">
      {/* Aviso multi-tenant */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          La configuración es <strong>única para toda la empresa</strong> (
          {empresaActual.nombre}). Todos los usuarios llamarán mostrando el
          mismo número como identificador. No hay configuración por usuario ni
          por departamento.
        </p>
      </div>

      {/* Estado */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="h-4 w-4 text-sky-600" />
          <span className="font-medium">Estado</span>
        </div>
        {conectado ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <Wifi className="h-3 w-3" /> Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            <WifiOff className="h-3 w-3" /> Sin configurar
          </span>
        )}
      </div>

      {/* Proveedor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Proveedor de telefonía</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {PROVEEDORES.map((p) => (
            <label
              key={p.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                t.proveedor === p.id
                  ? "border-sky-500 bg-sky-50"
                  : "border-border hover:border-sky-300"
              }`}
            >
              <input
                type="radio"
                name="proveedor-telefonia"
                checked={t.proveedor === p.id}
                onChange={() => set("proveedor", p.id)}
                className="mt-1 accent-sky-600"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Identidad saliente */}
      {conectado && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Identidad saliente</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Número a mostrar (CallerID)
              </Label>
              <Input
                value={t.callerId}
                onChange={(e) => set("callerId", e.target.value)}
                placeholder="+34 91 000 00 00"
                className="mt-1 h-9 font-mono text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Es el número de la empresa que verán las personas a las que
                llames.
              </p>
            </div>
            <div>
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Nombre a mostrar
              </Label>
              <Input
                value={t.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder={empresaActual.nombre}
                className="mt-1 h-9 text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Aparece cuando el destinatario tiene CNAM o identificador
                avanzado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credenciales SIP */}
      {necesitaSip && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {t.proveedor === "b2com_sip"
                ? "Credenciales SIP de B2COM"
                : "Credenciales SIP"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {t.proveedor === "b2com_sip" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Si aún no tienes estos datos, pídeselos a B2COM. Usa el correo
                de plantilla que te facilita el sistema.
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Servidor SIP (host o WebSocket)
                </Label>
                <Input
                  value={t.sipServer}
                  onChange={(e) => set("sipServer", e.target.value)}
                  placeholder="wss://sip.b2com.es:7443"
                  className="mt-1 h-9 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Usuario SIP / Extensión
                </Label>
                <Input
                  value={t.sipUser}
                  onChange={(e) => set("sipUser", e.target.value)}
                  placeholder="91000XXXX"
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Contraseña SIP
                </Label>
                <Input
                  type="password"
                  value={t.sipPassword}
                  onChange={(e) => set("sipPassword", e.target.value)}
                  className="mt-1 h-9 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credenciales Twilio */}
      {necesitaTwilio && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Credenciales Twilio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
              El número CallerID debe estar verificado en tu cuenta Twilio
              (Phone Numbers → Verified Caller IDs).
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Account SID
                </Label>
                <Input
                  value={t.twilioAccountSid}
                  onChange={(e) => set("twilioAccountSid", e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="mt-1 h-9 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Auth Token
                </Label>
                <Input
                  type="password"
                  value={t.twilioAuthToken}
                  onChange={(e) => set("twilioAuthToken", e.target.value)}
                  className="mt-1 h-9 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  TwiML App SID
                </Label>
                <Input
                  value={t.twilioAppSid}
                  onChange={(e) => set("twilioAppSid", e.target.value)}
                  placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="mt-1 h-9 font-mono text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Opciones */}
      {conectado && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Opciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Grabar llamadas</p>
                <p className="text-[11px] text-muted-foreground">
                  Guarda audio de las llamadas para auditoría. Verifica antes la
                  normativa aplicable y avisa al interlocutor.
                </p>
              </div>
              <Switch
                checked={t.grabarLlamadas}
                onCheckedChange={(v) => set("grabarLlamadas", v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      <div className="flex items-center justify-between">
        {conectado ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              set("proveedor", "none");
              toast.message("Telefonía desconectada");
            }}
          >
            Desconectar
          </Button>
        ) : (
          <span />
        )}
        <Button
          onClick={() =>
            toast.success("Configuración de telefonía guardada", {
              description: `Activa para ${empresaActual.nombre}`,
            })
          }
        >
          GUARDAR CONFIGURACIÓN
        </Button>
      </div>
    </div>
  );
}
