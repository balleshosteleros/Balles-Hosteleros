"use client";

/**
 * Panel de configuración de la landing de visita (Ajustes → Herramientas).
 *
 * Una sola pantalla, sin builder ni nodos. La empresa edita:
 *   - Activado / desactivado.
 *   - Textos de bienvenida.
 *   - Textos del pop-up de captura.
 *   - Email de follow-up: asunto, cuerpo, cuándo enviarlo.
 *   - Filtro 5⭐ → Google (toggle + URL de reseñas Google).
 *
 * Genera el QR descargable que apunta a /v/[carta_slug].
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Sparkles,
  Star,
  Mail,
  Download,
  Info,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getVisitaConfig,
  guardarVisitaConfig,
  type VisitaConfigData,
} from "@/features/ajustes/actions/visita-actions";

type UnidadTiempo = "minutos" | "horas" | "dias";

function delayATiempo(delayMin: number): { valor: number; unidad: UnidadTiempo } {
  if (delayMin === 0) return { valor: 0, unidad: "minutos" };
  if (delayMin % (60 * 24) === 0) return { valor: delayMin / (60 * 24), unidad: "dias" };
  if (delayMin % 60 === 0) return { valor: delayMin / 60, unidad: "horas" };
  return { valor: delayMin, unidad: "minutos" };
}

function tiempoADelay(valor: number, unidad: UnidadTiempo): number {
  if (unidad === "dias") return valor * 60 * 24;
  if (unidad === "horas") return valor * 60;
  return valor;
}

export function VisitaLandingConfigPanel() {
  const [cfg, setCfg] = useState<VisitaConfigData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let activo = true;
    getVisitaConfig().then((data) => {
      if (!activo) return;
      setCfg(data);
      setCargando(false);
    });
    return () => {
      activo = false;
    };
  }, []);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  if (cargando || !cfg) {
    return (
      <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
        Cargando configuración…
      </div>
    );
  }

  const set = <K extends keyof VisitaConfigData>(
    key: K,
    value: VisitaConfigData[K],
  ) => {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const onGuardar = async () => {
    setGuardando(true);
    const r = await guardarVisitaConfig({
      activado: cfg.activado,
      hero_url: cfg.hero_url ?? null,
      bienvenida_titulo: cfg.bienvenida_titulo,
      bienvenida_subtitulo: cfg.bienvenida_subtitulo,
      popup_titulo: cfg.popup_titulo,
      popup_subtitulo: cfg.popup_subtitulo,
      popup_boton_texto: cfg.popup_boton_texto,
      email_asunto: cfg.email_asunto,
      email_cuerpo: cfg.email_cuerpo,
      email_delay_minutos: cfg.email_delay_minutos,
      redirigir_5estrellas_google: cfg.redirigir_5estrellas_google,
      google_review_url: cfg.google_review_url ?? null,
    });
    setGuardando(false);
    if (r.ok) toast.success("Landing guardada");
    else toast.error("No se pudo guardar", { description: r.error });
  };

  const descargarQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 1024;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "qr-landing.png";
        a.click();
        URL.revokeObjectURL(a.href);
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    img.src = url;
  };

  const linkLanding =
    cfg.carta_slug && baseUrl ? `${baseUrl}/v/${cfg.carta_slug}` : "";

  const { valor: delayValor, unidad: delayUnidad } = delayATiempo(
    cfg.email_delay_minutos,
  );

  return (
    <div className="space-y-5 py-2">
      {/* Aviso intro */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Cuando el cliente escanee el QR, abrirá una página personalizada con
          el logo y colores de tu empresa. Después de unos segundos verá un
          pop-up suave para suscribirse. Quien se suscriba recibirá un email a
          las {Math.round(cfg.email_delay_minutos / 60)} h pidiéndole una
          valoración.
        </p>
      </div>

      {!cfg.carta_slug && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Tu empresa todavía no tiene <strong>slug de carta</strong>{" "}
            configurado, así que la landing aún no tiene URL pública. Configura
            primero la <em>Carta digital</em> en su submódulo.
          </p>
        </div>
      )}

      {/* Estado */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span className="font-medium">Estado</span>
          {cfg.activado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              <Wifi className="h-3 w-3" /> Activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <WifiOff className="h-3 w-3" /> Desactivada
            </span>
          )}
        </div>
        <Switch
          checked={cfg.activado}
          onCheckedChange={(v) => set("activado", v)}
        />
      </div>

      {/* Bienvenida */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Bienvenida</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Título grande
            </Label>
            <Input
              value={cfg.bienvenida_titulo}
              onChange={(e) => set("bienvenida_titulo", e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Subtítulo
            </Label>
            <Textarea
              value={cfg.bienvenida_subtitulo}
              onChange={(e) => set("bienvenida_subtitulo", e.target.value)}
              rows={2}
              className="mt-1 text-sm"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Puedes usar{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              {"{nombre_empresa}"}
            </code>{" "}
            — se sustituye automáticamente.
          </p>
        </CardContent>
      </Card>

      {/* Pop-up captura */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Pop-up de captura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Título
            </Label>
            <Input
              value={cfg.popup_titulo}
              onChange={(e) => set("popup_titulo", e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Subtítulo
            </Label>
            <Textarea
              value={cfg.popup_subtitulo}
              onChange={(e) => set("popup_subtitulo", e.target.value)}
              rows={2}
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Texto del botón
            </Label>
            <Input
              value={cfg.popup_boton_texto}
              onChange={(e) => set("popup_boton_texto", e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email follow-up */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-sky-600" />
            Email de recordatorio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Enviar después de</span>
            <Input
              type="number"
              min={0}
              value={delayValor}
              onChange={(e) =>
                set(
                  "email_delay_minutos",
                  tiempoADelay(Number(e.target.value) || 0, delayUnidad),
                )
              }
              className="h-8 w-20 text-sm"
            />
            <Select
              value={delayUnidad}
              onValueChange={(v) =>
                set(
                  "email_delay_minutos",
                  tiempoADelay(delayValor, v as UnidadTiempo),
                )
              }
            >
              <SelectTrigger className="h-8 w-28 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutos">minutos</SelectItem>
                <SelectItem value="horas">horas</SelectItem>
                <SelectItem value="dias">días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Asunto
            </Label>
            <Input
              value={cfg.email_asunto}
              onChange={(e) => set("email_asunto", e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">
              Cuerpo
            </Label>
            <Textarea
              value={cfg.email_cuerpo}
              onChange={(e) => set("email_cuerpo", e.target.value)}
              rows={6}
              className="mt-1 text-sm"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              Usa{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                {"{nombre}"}
              </code>{" "}
              y{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                {"{nombre_empresa}"}
              </code>
              . El email incluye 5 estrellas tappables al final.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filtro 5⭐ → Google */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Star className="h-4 w-4 text-yellow-500" />
            Filtro 5⭐ → Google
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium">
                Llevar a Google solo a los más contentos
              </p>
              <p className="text-[11px] text-muted-foreground">
                Si la valoración es de 5 estrellas, redirige a Google Reviews.
                Si es menor, la reseña queda en tu pipeline interno. Protege tu
                reputación pública.
              </p>
            </div>
            <Switch
              checked={cfg.redirigir_5estrellas_google}
              onCheckedChange={(v) => set("redirigir_5estrellas_google", v)}
            />
          </div>
          {cfg.redirigir_5estrellas_google && (
            <div>
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                URL de reseña en Google
              </Label>
              <Input
                value={cfg.google_review_url ?? ""}
                onChange={(e) =>
                  set("google_review_url", e.target.value || null)
                }
                placeholder="https://g.page/r/..."
                className="mt-1 h-9 text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Obténla en tu ficha de Google Maps → «Compartir reseña».
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR para imprimir */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">QR para imprimir</CardTitle>
        </CardHeader>
        <CardContent>
          {linkLanding ? (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <div
                ref={qrRef}
                className="rounded-lg border bg-white p-3"
                aria-label="Código QR de la landing"
              >
                <QRCodeSVG value={linkLanding} size={160} level="M" includeMargin />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Al escanearlo, el cliente abre tu landing personalizada.
                </p>
                <code className="block break-all rounded bg-muted px-2 py-1 font-mono text-[10px]">
                  {linkLanding}
                </code>
                <Button size="sm" variant="outline" onClick={descargarQR}>
                  <Download className="mr-1 h-4 w-4" />
                  Descargar QR
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-xs text-muted-foreground">
              Configura el slug de la carta digital para generar el QR.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones */}
      <div className="flex items-center justify-end">
        <Button onClick={onGuardar} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}
