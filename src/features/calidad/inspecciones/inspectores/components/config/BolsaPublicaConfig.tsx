"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ExternalLink,
  Copy,
  Check,
  Code,
  Link2,
  Palette,
  Type,
  Loader2,
  Eye,
} from "lucide-react";
import { getBolsaConfig, saveBolsaConfig } from "../../actions";
import { BOLSA_CONFIG_DEFAULTS, type BolsaConfig } from "../../types";

const PLACEHOLDER_SLUG = "[empresa]";

export function BolsaPublicaConfig() {
  const [config, setConfig] = useState<BolsaConfig>(BOLSA_CONFIG_DEFAULTS);
  const [empresaSlug, setEmpresaSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await getBolsaConfig();
      if (res.ok) {
        setConfig(res.config);
        setEmpresaSlug(res.empresaSlug);
      }
      setLoading(false);
    })();
  }, []);

  const origin = useMemo(() => {
    if (typeof window === "undefined") return "https://sistema.balleshosteleros.com";
    return window.location.origin;
  }, []);

  const slugSafe = empresaSlug ?? PLACEHOLDER_SLUG;
  const url = `${origin}/inspectores/bolsa/${slugSafe}`;

  const iframeSnippet = useMemo(() => {
    return `<iframe
  src="${url}"
  title="Bolsa de inspectores"
  width="100%"
  height="900"
  style="border:0; max-width:100%;"
  loading="lazy"
></iframe>`;
  }, [url]);

  function update<K extends keyof BolsaConfig>(key: K, value: BolsaConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
    setDirty(true);
  }

  function copy(label: string, text: string) {
    if (typeof navigator === "undefined") return;
    void navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copiado al portapapeles");
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleSave() {
    setSaving(true);
    const res = await saveBolsaConfig(config);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDirty(false);
    toast.success("Cambios guardados");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const urlOk = empresaSlug !== null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Bolsa pública</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Formulario público donde los inspectores se inscriben en tu bolsa.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label className="text-xs text-muted-foreground">Bolsa activa</Label>
          <Switch
            checked={config.activa}
            onCheckedChange={(v) => update("activa", v)}
          />
        </div>
      </div>

      {/* URL pública + abrir */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">URL pública</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compártela en LinkedIn, WhatsApp o tu firma de email.
            </p>
          </div>
        </div>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-2">
            <Input value={url} readOnly className="font-mono text-xs" />
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Copiar URL"
              onClick={() => copy("url", url)}
              disabled={!urlOk}
            >
              {copied === "url" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Abrir en nueva pestaña"
              asChild
              disabled={!urlOk}
            >
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
          {!urlOk && (
            <p className="text-[11px] text-amber-600">
              La empresa no tiene <code>slug</code>. Configúralo en Ajustes →
              Empresas para activar la URL.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Iframe para incrustar */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Code className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">
              Incrustar en tu web
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pega este código HTML en tu sitio donde quieras que aparezca el
              formulario.
            </p>
          </div>
        </div>
        <CardContent className="p-5 space-y-3">
          <Textarea
            value={iframeSnippet}
            readOnly
            rows={7}
            className="font-mono text-[11px]"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => copy("iframe", iframeSnippet)}
            disabled={!urlOk}
          >
            {copied === "iframe" ? (
              <>
                <Check className="h-4 w-4 mr-1.5" /> Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1.5" /> Copiar código iframe
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Textos editables */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">
              Textos visibles
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personaliza la cabecera, el botón y los mensajes.
            </p>
          </div>
        </div>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Etiqueta superior
            </Label>
            <Input
              value={config.titulo_seccion}
              onChange={(e) => update("titulo_seccion", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Título principal
            </Label>
            <Input
              value={config.titulo_principal}
              onChange={(e) => update("titulo_principal", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descripción</Label>
            <Textarea
              rows={3}
              value={config.descripcion}
              onChange={(e) => update("descripcion", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Texto del botón
            </Label>
            <Input
              value={config.texto_boton}
              onChange={(e) => update("texto_boton", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Confirmación — título
              </Label>
              <Input
                value={config.mensaje_exito_titulo}
                onChange={(e) => update("mensaje_exito_titulo", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Confirmación — texto
              </Label>
              <Textarea
                rows={2}
                value={config.mensaje_exito_texto}
                onChange={(e) => update("mensaje_exito_texto", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visual / colores */}
      <Card>
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <div>
            <h3 className="font-semibold text-foreground text-sm">Visual</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Si dejas un color vacío, se usará el branding de tu empresa.
            </p>
          </div>
        </div>
        <CardContent className="p-5 space-y-4">
          <ColorField
            label="Fondo de la página"
            value={config.color_fondo}
            onChange={(v) => update("color_fondo", v)}
          />
          <ColorField
            label="Color de acento (botón)"
            value={config.color_acento}
            onChange={(v) => update("color_acento", v)}
          />
          <ColorField
            label="Color del texto sobre el fondo"
            value={config.color_texto}
            onChange={(v) => update("color_texto", v)}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-3 -mx-1 px-1 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          asChild
          disabled={!urlOk}
          className="gap-1.5"
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Eye className="h-3.5 w-3.5" /> Vista previa
          </a>
        </Button>
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const isSet = value !== null && value !== "";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-input cursor-pointer bg-transparent"
          aria-label={label}
        />
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder="Hereda del branding de empresa"
          className="font-mono text-xs flex-1"
        />
        {isSet && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-xs text-muted-foreground"
            onClick={() => onChange(null)}
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
