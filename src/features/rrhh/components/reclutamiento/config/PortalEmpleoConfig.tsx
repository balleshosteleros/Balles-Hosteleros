import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Eye, Globe, Code, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import {
  getEmpleoUrlConfig,
  updateEmpleoUrlSlug,
} from "@/features/rrhh/actions/reclutamiento-actions";

/** Solo deja el nombre apto para URL (igual que el servidor) — feedback en vivo. */
function sanitize(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "");
}

export function PortalEmpleoConfig() {
  const { empresaActual } = useEmpresa();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  // `guardado` = lo que vive en BD (URL que funciona). `valor` = lo que se edita.
  const [guardado, setGuardado] = useState("");
  const [valor, setValor] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let alive = true;
    setCargando(true);
    getEmpleoUrlConfig()
      .then((cfg) => {
        if (!alive) return;
        const inicial = cfg?.empleoSlug || sanitize(cfg?.nombreComercial ?? empresaActual.nombre);
        setGuardado(inicial);
        setValor(inicial);
      })
      .catch((err) => console.error("[PortalEmpleoConfig] getEmpleoUrlConfig:", err))
      .finally(() => {
        if (alive) setCargando(false);
      });
    return () => {
      alive = false;
    };
  }, [empresaActual.id, empresaActual.nombre]);

  const urlGuardada = useMemo(
    () => (origin && guardado ? `${origin}/empleo/${guardado}` : ""),
    [origin, guardado],
  );
  const urlPreview = useMemo(
    () => (origin && valor ? `${origin}/empleo/${valor}` : ""),
    [origin, valor],
  );
  const iframeCode = useMemo(
    () =>
      urlGuardada
        ? `<iframe src="${urlGuardada}" width="100%" height="800" frameborder="0" style="border:none; border-radius:8px;"></iframe>`
        : "",
    [urlGuardada],
  );

  const hayCambios = valor !== guardado;

  const copiar = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  const guardar = async () => {
    const limpio = sanitize(valor).replace(/-+$/, "");
    if (!limpio) {
      toast.error("Escribe un nombre válido para la URL.");
      return;
    }
    setGuardando(true);
    try {
      const res = await updateEmpleoUrlSlug(limpio);
      if (res.ok) {
        setGuardado(res.empleoSlug);
        setValor(res.empleoSlug);
        toast.success("URL del portal de empleo guardada");
      } else if (res.sugerencia) {
        const sugerida = res.sugerencia;
        toast.error(res.error, {
          action: {
            label: `Usar "${sugerida}"`,
            onClick: () => setValor(sugerida),
          },
        });
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      console.error("[PortalEmpleoConfig] guardar:", err);
      toast.error("No se pudo guardar la URL.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Portal de empleo</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personaliza la URL pública donde tus candidatos verán las vacantes — {empresaActual.nombre}
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild disabled={!urlGuardada}>
          <a href={urlGuardada || "#"} target="_blank" rel="noopener noreferrer">
            <Eye className="h-4 w-4" /> Ver portal
          </a>
        </Button>
      </div>

      {/* ── Nombre de tu empresa en la URL ───────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Nombre de tu empresa en la URL</span>
        </div>
        <CardContent className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Escribe el nombre de tu empresa, el cual aparecerá en la URL que verán tus futuros candidatos.
            Por defecto usamos el nombre comercial que ya guardaste.
          </p>

          {cargando ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
            </div>
          ) : (
            <>
              <div className="max-w-md">
                <Label className="text-xs">Nombre en la URL</Label>
                <Input
                  value={valor}
                  onChange={(e) => setValor(sanitize(e.target.value))}
                  placeholder={empresaActual.nombre}
                  className="mt-1"
                  maxLength={60}
                />
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  La URL para poder ver todas tus vacantes quedará así:
                </p>
                <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-4 py-3 border border-border">
                  <span className="text-sm font-mono text-primary flex-1 truncate">
                    {urlPreview || "—"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => copiar(urlGuardada, "URL")}
                    disabled={hayCambios || !urlGuardada}
                    title={hayCambios ? "Guarda los cambios antes de copiar" : undefined}
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
                {hayCambios && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    Tienes cambios sin guardar. Pulsa «Guardar URL» para activarlos.
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button className="gap-1.5" onClick={guardar} disabled={guardando || !hayCambios}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar URL
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Iframe ───────────────────────────────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Code className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Código iframe para incrustar</span>
        </div>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            Utiliza este código para incrustar el portal de empleo en la página web de tu empresa.
            Copia el código y pégalo en el HTML de tu sitio.
          </p>
          <div className="relative">
            <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono text-foreground border border-border overflow-x-auto whitespace-pre-wrap break-all min-h-[3rem]">
              {iframeCode || "Guarda la URL para generar el código."}
            </pre>
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 gap-1.5"
              onClick={() => copiar(iframeCode, "Código iframe")}
              disabled={!iframeCode}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Ajusta el atributo «height» según las necesidades de tu web. El ancho se adapta automáticamente al contenedor.
          </p>
        </CardContent>
      </Card>

      {/* ── Apariencia → vive en Imagen de Marca ─────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Logo y colores del portal</span>
        </div>
        <CardContent className="p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            El logotipo, la paleta de colores y las tipografías del portal de empleo se heredan
            automáticamente de la identidad visual de tu empresa. Se editan en un único sitio:
            <span className="text-foreground font-medium"> Ajustes → Imagen de marca</span>.
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/ajustes?tab=imagen-marca">
              <ExternalLink className="h-4 w-4" /> Ir a Imagen de marca
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
