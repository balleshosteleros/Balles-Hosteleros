"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Send, Save, Info, CheckCircle2, XCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getEmpresaEmailConfig,
  saveEmpresaEmailConfig,
  testEmpresaEmailConfig,
  type EmpresaEmailConfigInput,
} from "@/features/ajustes/actions/email-config-actions";

type Preset = {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  hint?: string;
};

const PRESETS: Preset[] = [
  {
    id: "gmail",
    label: "Gmail / Google Workspace",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    hint:
      "Necesitas una App Password (16 caracteres). Genérala en " +
      "myaccount.google.com → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones.",
  },
  {
    id: "outlook",
    label: "Outlook / Microsoft 365",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    hint:
      "Usa la contraseña de la cuenta. Si tienes 2FA activado, genera una App Password " +
      "en account.microsoft.com → Seguridad → Contraseñas de aplicación.",
  },
  {
    id: "ionos",
    label: "IONOS / 1&1",
    host: "smtp.ionos.es",
    port: 587,
    secure: false,
    hint: "Usa el email completo de la cuenta como usuario y la contraseña habitual.",
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    host: "smtp.zoho.eu",
    port: 587,
    secure: false,
    hint: "Si tu cuenta es .com usa smtp.zoho.com; si es .eu deja smtp.zoho.eu.",
  },
  {
    id: "custom",
    label: "Otro / SMTP personalizado",
    host: "",
    port: 587,
    secure: false,
  },
];

const PASSWORD_MASK = "__keep__";

const EMPTY_FORM: EmpresaEmailConfigInput = {
  smtp_host: "",
  smtp_port: 587,
  smtp_secure: false,
  smtp_user: "",
  smtp_password: "",
  from_email: "",
  from_name: "",
  enabled: true,
};

export function EmailConfigCard() {
  const { empresaActual } = useEmpresa();
  // empresa_email_config.empresa_id es UUID en BD, no slug. Usar dbId.
  const empresaId = empresaActual.dbId;

  const [form, setForm] = useState<EmpresaEmailConfigInput>(EMPTY_FORM);
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [preset, setPreset] = useState<string>("gmail");
  const [testTo, setTestTo] = useState<string>("");
  const [lastTest, setLastTest] = useState<{
    at: string | null;
    ok: boolean | null;
    error: string | null;
  }>({ at: null, ok: null, error: null });

  // Cargar config existente al cambiar de empresa
  useEffect(() => {
    if (!empresaId) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    getEmpresaEmailConfig(empresaId).then((res) => {
      if (!alive) return;
      if (res.error) {
        toast.error(res.error);
      }
      if (res.data) {
        setExists(true);
        setForm({
          smtp_host: res.data.smtp_host,
          smtp_port: res.data.smtp_port,
          smtp_secure: res.data.smtp_secure,
          smtp_user: res.data.smtp_user,
          smtp_password: res.data.smtp_password, // PASSWORD_MASK
          from_email: res.data.from_email,
          from_name: res.data.from_name ?? "",
          enabled: res.data.enabled,
        });
        setLastTest({
          at: res.data.last_test_at,
          ok: res.data.last_test_ok,
          error: res.data.last_test_error,
        });
        // Inferir preset por host
        const found = PRESETS.find((p) => p.host && p.host === res.data!.smtp_host);
        setPreset(found?.id ?? "custom");
      } else {
        setExists(false);
        setForm(EMPTY_FORM);
        setLastTest({ at: null, ok: null, error: null });
        setPreset("gmail");
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [empresaId]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (!p || p.id === "custom") return;
    setForm((prev) => ({
      ...prev,
      smtp_host: p.host,
      smtp_port: p.port,
      smtp_secure: p.secure,
    }));
  };

  const handleSave = async () => {
    if (!empresaId) {
      toast.error("Empresa no sincronizada con la base de datos");
      return;
    }
    setSaving(true);
    const res = await saveEmpresaEmailConfig(empresaId, form);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Configuración de correo guardada");
    setExists(true);
    // Tras guardar, el password real queda en BD; mostramos máscara
    setForm((prev) => ({ ...prev, smtp_password: PASSWORD_MASK }));
  };

  const handleTest = async () => {
    if (!empresaId) {
      toast.error("Empresa no sincronizada con la base de datos");
      return;
    }
    if (!testTo.trim()) {
      toast.error("Indica un email destinatario para la prueba");
      return;
    }
    setTesting(true);
    const res = await testEmpresaEmailConfig(empresaId, form, testTo.trim());
    setTesting(false);
    if (res.error) {
      toast.error(`Falló el envío: ${res.error}`);
      setLastTest({ at: new Date().toISOString(), ok: false, error: res.error });
    } else {
      toast.success(`Correo de prueba enviado a ${testTo.trim()}`);
      setLastTest({ at: new Date().toISOString(), ok: true, error: null });
    }
  };

  const presetHint = PRESETS.find((p) => p.id === preset)?.hint;

  return (
    <Card>
      <CardHeader className="px-4 pt-3 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          Correo saliente de la empresa
        </CardTitle>
        <div className="flex items-center gap-3">
          {exists && (
            <Badge variant={form.enabled ? "default" : "outline"} className="text-[10px]">
              {form.enabled ? "Activo" : "Desactivado"}
            </Badge>
          )}
          {lastTest.ok === true && (
            <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/40 text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Última prueba OK
            </Badge>
          )}
          {lastTest.ok === false && (
            <Badge variant="outline" className="text-[10px] gap-1 border-red-500/40 text-red-700">
              <XCircle className="h-3 w-3" /> Última prueba falló
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-3 pt-0">
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Conecta el correo de la empresa para que las recuperaciones de contraseña
            y avisos del sistema salgan desde tu propio buzón
            (ej. <code className="bg-background px-1 rounded text-[10px]">no-reply@tu-empresa.com</code>).
            Si lo dejas en blanco, el sistema usará el correo por defecto del software.
          </p>
        </div>

        {/* Preset */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <Label className="text-xs font-bold uppercase">Proveedor</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {presetHint && (
              <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{presetHint}</p>
            )}
          </div>

          <div className="md:col-span-2 grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs font-bold uppercase">Servidor SMTP</Label>
              <Input
                className="mt-1"
                value={form.smtp_host}
                onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase">Puerto</Label>
              <Input
                className="mt-1"
                type="number"
                value={form.smtp_port}
                onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })}
              />
              <div className="mt-1 flex items-center gap-2">
                <Switch
                  checked={form.smtp_secure}
                  onCheckedChange={(v) => setForm({ ...form, smtp_secure: v })}
                />
                <span className="text-[10px] text-muted-foreground">SSL (puerto 465)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Credenciales */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs font-bold uppercase">Usuario SMTP</Label>
            <Input
              className="mt-1"
              value={form.smtp_user}
              onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
              placeholder="tu-correo@tu-empresa.com"
              autoComplete="off"
            />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">
              Contraseña / App Password
            </Label>
            <div className="relative mt-1">
              <Input
                type={showPwd ? "text" : "password"}
                value={form.smtp_password}
                onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                placeholder={exists ? "Déjalo en blanco para conservar la actual" : "16 caracteres en Gmail"}
                autoComplete="new-password"
                className="pr-9"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-muted-foreground"
                aria-label={showPwd ? "Ocultar" : "Mostrar"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Remitente visible */}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label className="text-xs font-bold uppercase">Remitente (nombre visible)</Label>
            <Input
              className="mt-1"
              value={form.from_name ?? ""}
              onChange={(e) => setForm({ ...form, from_name: e.target.value })}
              placeholder="Balles Hosteleros"
            />
          </div>
          <div>
            <Label className="text-xs font-bold uppercase">Remitente (correo de envío)</Label>
            <Input
              className="mt-1"
              type="email"
              value={form.from_email}
              onChange={(e) => setForm({ ...form, from_email: e.target.value })}
              placeholder="no-reply@tu-empresa.com"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Switch
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          />
          <span className="text-xs">Activar envío con este SMTP</span>
        </div>

        {/* Acciones */}
        <div className="flex flex-col md:flex-row md:items-end gap-2 pt-1">
          <div className="flex-1">
            <Label className="text-xs font-bold uppercase">Email destinatario para prueba</Label>
            <Input
              className="mt-1"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="tu-correo-personal@gmail.com"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={testing || loading}
              onClick={handleTest}
            >
              <Send className="h-3.5 w-3.5" />
              {testing ? "Enviando..." : "Enviar prueba"}
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={saving || loading}
              onClick={handleSave}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>

        {lastTest.ok === false && lastTest.error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-700">
            <strong>Detalle del último error:</strong> {lastTest.error}
          </div>
        )}
        {loading && (
          <p className="text-xs text-muted-foreground">Cargando configuración…</p>
        )}
      </CardContent>
    </Card>
  );
}
