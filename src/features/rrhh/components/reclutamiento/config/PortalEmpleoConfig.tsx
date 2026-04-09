import { useState } from "react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Copy, Upload, Trash2, ExternalLink, Eye, Palette, Globe, Code, Image, Type } from "lucide-react";
import { toast } from "sonner";

export function PortalEmpleoConfig() {
  const { empresaActual } = useEmpresa();
  const [nombreUrl, setNombreUrl] = useState(empresaActual.id);
  const [titulo, setTitulo] = useState(`¡Únete a nuestro equipo ${empresaActual.nombre}!`);
  const [textoBienvenida, setTextoBienvenida] = useState("Buscamos personas apasionadas por la hostelería que quieran formar parte de un equipo dinámico y profesional.");
  const [tituloSobreNosotros, setTituloSobreNosotros] = useState("Conócenos un poquito más...");
  const [textoSobreNosotros, setTextoSobreNosotros] = useState("");

  // Visual customization
  const [colorPrimario, setColorPrimario] = useState("#8B1A4A");
  const [colorSecundario, setColorSecundario] = useState("#F5E6D3");
  const [colorBoton, setColorBoton] = useState("#8B1A4A");
  const [colorTexto, setColorTexto] = useState("#1a1a2e");

  const portalPath = `/portal-empleo/${nombreUrl}`;
  const urlBase = `${window.location.origin}${portalPath}`;
  const iframeCode = `<iframe src="${urlBase}" width="100%" height="800" frameborder="0" style="border:none; border-radius:8px;"></iframe>`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Portal de empleo</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configura tu portal de empleo público para recibir candidaturas — {empresaActual.nombre}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={portalPath} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Abrir portal
            </a>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={portalPath} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4" /> Vista previa
            </a>
          </Button>
        </div>
      </div>

      {/* ── URL directa ──────────────────────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">URL directa del portal</span>
        </div>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            Comparte esta URL directamente con los candidatos. Ideal si la empresa no tiene página web propia.
          </p>
          <div>
            <Label className="text-xs">Nombre en la URL</Label>
            <Input
              value={nombreUrl}
              onChange={(e) => setNombreUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="mt-1 max-w-md"
            />
          </div>
          <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-4 py-3 border border-border">
            <span className="text-sm font-mono text-foreground flex-1 truncate">{urlBase}</span>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => copyToClipboard(urlBase, "URL")}>
              <Copy className="h-3.5 w-3.5" /> Copiar URL
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
              <a href={portalPath} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Iframe ───────────────────────────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Code className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Código iframe para incrustar</span>
        </div>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            Utiliza este código para incrustar el portal de empleo en tu página web externa. Copia el código y pégalo en el HTML de tu sitio.
          </p>
          <div className="relative">
            <pre className="bg-muted/50 rounded-lg p-4 text-xs font-mono text-foreground border border-border overflow-x-auto whitespace-pre-wrap break-all">
              {iframeCode}
            </pre>
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 gap-1.5"
              onClick={() => copyToClipboard(iframeCode, "Código iframe")}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground italic">
            Ajusta el atributo "height" según las necesidades de tu web. El ancho se adapta automáticamente al contenedor.
          </p>
        </CardContent>
      </Card>

      {/* ── Imagen al compartir ──────────────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Image className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Imagen al compartir</span>
        </div>
        <CardContent className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            Cuando compartas la URL de una vacante se adjuntará esta imagen para la previsualización en redes sociales.
          </p>
          <div className="flex items-start gap-4">
            <div className="w-48 h-28 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
              <div className="text-center">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <span className="text-xs text-muted-foreground">Subir imagen</span>
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" /> Cambiar imagen
              </Button>
              <br />
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bienvenida ───────────────────────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Type className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Textos del portal</span>
        </div>
        <CardContent className="p-5 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Título de bienvenida</Label>
            <div className="relative">
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={100} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{titulo.length}/100</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Texto de bienvenida</Label>
            <Textarea
              value={textoBienvenida}
              onChange={(e) => setTextoBienvenida(e.target.value)}
              placeholder="Escribe un texto que dé la bienvenida a tus futuros candidatos..."
              className="min-h-[100px]"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs font-medium">Título "Sobre nosotros"</Label>
            <Input value={tituloSobreNosotros} onChange={(e) => setTituloSobreNosotros(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium">Texto "Sobre nosotros"</Label>
            <Textarea
              value={textoSobreNosotros}
              onChange={(e) => setTextoSobreNosotros(e.target.value)}
              placeholder="Explica a tus candidatos todo lo que necesitan saber sobre tu empresa..."
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Personalización visual ───────────────────── */}
      <Card>
        <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Personalización visual</span>
        </div>
        <CardContent className="p-5">
          <p className="text-xs text-muted-foreground mb-5">
            Personaliza los colores de tu portal de empleo para que se alinee con la identidad visual de tu empresa.
          </p>
          <div className="grid grid-cols-2 gap-5">
            <ColorPicker label="Color principal" description="Cabecera y elementos destacados" value={colorPrimario} onChange={setColorPrimario} />
            <ColorPicker label="Color secundario" description="Fondo y zonas suaves" value={colorSecundario} onChange={setColorSecundario} />
            <ColorPicker label="Color de botones" description="Botones de acción y CTA" value={colorBoton} onChange={setColorBoton} />
            <ColorPicker label="Color de textos" description="Títulos y textos principales" value={colorTexto} onChange={setColorTexto} />
          </div>

          <Separator className="my-5" />

          {/* Logo */}
          <div className="space-y-3">
            <Label className="text-xs font-medium">Logotipo de la empresa</Label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30">
                <Upload className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Upload className="h-3.5 w-3.5" /> Subir logotipo
                </Button>
                <p className="text-[10px] text-muted-foreground">PNG o SVG, fondo transparente recomendado</p>
              </div>
            </div>
          </div>

          <Separator className="my-5" />

          {/* Preview */}
          <div className="space-y-3">
            <Label className="text-xs font-medium">Vista previa del portal</Label>
            <div className="rounded-xl border border-border overflow-hidden shadow-sm">
              {/* Mini preview header */}
              <div className="px-6 py-8 text-center" style={{ backgroundColor: colorPrimario }}>
                <p className="text-white/70 text-[10px] uppercase tracking-wider mb-1">{empresaActual.nombre}</p>
                <p className="text-white font-bold text-sm">{titulo || "Título de bienvenida"}</p>
                <p className="text-white/70 text-[10px] mt-1 max-w-xs mx-auto truncate">{textoBienvenida || "Texto de bienvenida..."}</p>
              </div>
              {/* Mini preview body */}
              <div className="p-4 space-y-2" style={{ backgroundColor: colorSecundario + "40" }}>
                {["CAMARERO", "JEFE DE SALA", "ARTISTA / DJ"].map((nombre) => (
                  <div key={nombre} className="bg-white rounded-lg px-4 py-3 flex items-center justify-between border border-gray-100">
                    <div>
                      <p className="text-xs font-bold" style={{ color: colorTexto }}>{nombre}</p>
                      <p className="text-[9px] text-gray-400">Madrid · Jornada completa</p>
                    </div>
                    <div className="px-2 py-1 rounded text-[9px] text-white font-medium" style={{ backgroundColor: colorBoton }}>
                      Ver vacante
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-1.5" onClick={() => toast.success("Configuración del portal guardada")}>Guardar cambios</Button>
      </div>
    </div>
  );
}

// ─── Color Picker Component ─────────────────────────────────────
function ColorPicker({ label, description, value, onChange }: { label: string; description: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-lg border-2 border-border cursor-pointer shadow-sm" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <Label className="text-xs font-medium">{label}</Label>
        <p className="text-[10px] text-muted-foreground">{description}</p>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-7 text-xs font-mono max-w-[120px]" />
      </div>
    </div>
  );
}
