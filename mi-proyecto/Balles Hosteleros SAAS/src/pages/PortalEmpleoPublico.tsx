import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { EMPRESAS } from "@/contexts/EmpresaContext";
import { getVacantesDesdeRoles } from "@/data/roles-empresa";
import { TIPO_JORNADA_LABELS, type Vacante } from "@/data/reclutamiento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  MapPin, Clock, ChevronRight, Search, Upload, Briefcase,
  ArrowLeft, Send, CheckCircle2, Building2, Mail, Phone, User,
} from "lucide-react";
import { toast } from "sonner";

// ─── Default portal config per empresa ──────────────────────────
const PORTAL_DEFAULTS: Record<string, {
  colorPrimario: string; colorSecundario: string; colorBoton: string; colorTexto: string;
  titulo: string; textoBienvenida: string; tituloSobre: string; textoSobre: string;
  logo: string; imagenCabecera: string;
}> = {
  habana: {
    colorPrimario: "#8B1A4A", colorSecundario: "#F5E6D3", colorBoton: "#8B1A4A", colorTexto: "#1a1a2e",
    titulo: "¡Únete al equipo LA HABANA!",
    textoBienvenida: "Buscamos personas apasionadas por la hostelería que quieran formar parte de un equipo dinámico y profesional.",
    tituloSobre: "Sobre La Habana",
    textoSobre: "La Habana es un referente en la hostelería de Madrid, donde la calidad del servicio y el ambiente son nuestra seña de identidad.",
    logo: "", imagenCabecera: "",
  },
  bacanal: {
    colorPrimario: "#1E3A5F", colorSecundario: "#E8F0FE", colorBoton: "#1E3A5F", colorTexto: "#1a1a2e",
    titulo: "¡Únete al equipo BACANAL!",
    textoBienvenida: "Forma parte de un proyecto gastronómico único. Buscamos talento con ganas de crecer.",
    tituloSobre: "Sobre Bacanal",
    textoSobre: "Bacanal es un espacio gastronómico innovador donde la creatividad y la excelencia se unen.",
    logo: "", imagenCabecera: "",
  },
};

function getPortalConfig(empresaId: string) {
  return PORTAL_DEFAULTS[empresaId] || PORTAL_DEFAULTS.habana;
}

// ─── Application Form Dialog ────────────────────────────────────
function FormularioInscripcion({
  open, onOpenChange, vacante, config,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; vacante: Vacante | null;
  config: ReturnType<typeof getPortalConfig>;
}) {
  const [enviado, setEnviado] = useState(false);

  if (!vacante) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnviado(true);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setEnviado(false); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        {!enviado ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" style={{ color: config.colorPrimario }} />
                Inscripción — {vacante.puesto}
              </DialogTitle>
              <DialogDescription>Rellena tus datos para inscribirte a esta vacante</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nombre *</Label>
                  <Input required placeholder="Tu nombre" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Apellidos *</Label>
                  <Input required placeholder="Tus apellidos" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Teléfono *</Label>
                  <Input required type="tel" placeholder="612 345 678" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Email *</Label>
                  <Input required type="email" placeholder="tu@email.com" className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Disponibilidad</Label>
                <Select>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inmediata">Inmediata</SelectItem>
                    <SelectItem value="15dias">En 15 días</SelectItem>
                    <SelectItem value="1mes">En 1 mes</SelectItem>
                    <SelectItem value="negociable">Negociable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Carta de presentación / Mensaje</Label>
                <Textarea placeholder="Cuéntanos por qué te interesa esta vacante..." className="mt-1 min-h-[100px]" />
              </div>
              <div>
                <Label className="text-xs">CV (PDF, DOC) *</Label>
                <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Arrastra tu CV aquí o haz clic para seleccionar</p>
                </div>
              </div>
              <div>
                <Label className="text-xs">Observaciones</Label>
                <Textarea placeholder="Cualquier información adicional..." className="mt-1 min-h-[60px]" />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox required id="legal" className="mt-0.5" />
                <label htmlFor="legal" className="text-xs text-muted-foreground leading-relaxed">
                  Acepto la política de privacidad y el tratamiento de mis datos personales para el proceso de selección. *
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button type="submit" style={{ backgroundColor: config.colorBoton }} className="gap-1.5 text-white">
                  <Send className="h-4 w-4" /> Enviar candidatura
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <div className="py-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: config.colorPrimario + "15" }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: config.colorPrimario }} />
            </div>
            <h3 className="text-xl font-bold text-foreground">¡Candidatura enviada!</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Tu candidatura para <strong>{vacante.puesto}</strong> ha sido registrada correctamente.
              Nos pondremos en contacto contigo próximamente.
            </p>
            <Button variant="outline" onClick={() => { setEnviado(false); onOpenChange(false); }}>Volver al portal</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Vacancy Detail View ────────────────────────────────────────
function VacanteDetalle({
  vacante, config, onBack, onInscribirse,
}: {
  vacante: Vacante; config: ReturnType<typeof getPortalConfig>;
  onBack: () => void; onInscribirse: () => void;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-6 hover:underline" style={{ color: config.colorPrimario }}>
        <ArrowLeft className="h-4 w-4" /> Volver a vacantes
      </button>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-2" style={{ color: config.colorTexto }}>{vacante.puesto}</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{vacante.ubicacion}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{TIPO_JORNADA_LABELS[vacante.tipoJornada]}</span>
            <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" />{vacante.categoria}</span>
          </div>
          <div className="prose prose-sm max-w-none text-gray-600 mb-8">
            <p>Buscamos profesionales para incorporarse a nuestro equipo como <strong>{vacante.puesto}</strong>.</p>
            <p>Ubicación: {vacante.ubicacion}. Tipo de jornada: {TIPO_JORNADA_LABELS[vacante.tipoJornada]}.</p>
            <p>Si te interesa esta oportunidad, inscríbete a continuación.</p>
          </div>
          <Button size="lg" onClick={onInscribirse} className="gap-2 text-white" style={{ backgroundColor: config.colorBoton }}>
            <Send className="h-4 w-4" /> Inscribirme a esta vacante
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Public Portal ─────────────────────────────────────────
export default function PortalEmpleoPublico() {
  const { empresaId } = useParams<{ empresaId: string }>();
  const empresa = EMPRESAS.find((e) => e.id === empresaId);
  const config = getPortalConfig(empresaId || "habana");

  const vacantes = useMemo(() => {
    if (!empresaId) return [];
    return getVacantesDesdeRoles(empresaId).filter((v) => v.estadoPublicacion === "publicada");
  }, [empresaId]);

  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroJornada, setFiltroJornada] = useState("todas");
  const [selectedVacante, setSelectedVacante] = useState<Vacante | null>(null);
  const [inscripcionVacante, setInscripcionVacante] = useState<Vacante | null>(null);

  const categorias = useMemo(() => [...new Set(vacantes.map((v) => v.categoria))], [vacantes]);

  const filtered = useMemo(() => {
    let list = vacantes;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((v) => v.puesto.toLowerCase().includes(s) || v.ubicacion.toLowerCase().includes(s));
    }
    if (filtroCategoria !== "todas") list = list.filter((v) => v.categoria === filtroCategoria);
    if (filtroJornada !== "todas") list = list.filter((v) => v.tipoJornada === filtroJornada);
    return list;
  }, [vacantes, search, filtroCategoria, filtroJornada]);

  if (!empresa) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Portal no encontrado</h1>
          <p className="text-gray-500">La empresa solicitada no existe.</p>
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedVacante) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: config.colorSecundario + "40" }}>
        <header className="py-6 px-8" style={{ backgroundColor: config.colorPrimario }}>
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <Building2 className="h-6 w-6 text-white" />
            <span className="text-white font-bold text-lg">{empresa.nombre}</span>
          </div>
        </header>
        <main className="py-10 px-6">
          <VacanteDetalle
            vacante={selectedVacante}
            config={config}
            onBack={() => setSelectedVacante(null)}
            onInscribirse={() => setInscripcionVacante(selectedVacante)}
          />
        </main>
        <FormularioInscripcion
          open={!!inscripcionVacante}
          onOpenChange={(o) => !o && setInscripcionVacante(null)}
          vacante={inscripcionVacante}
          config={config}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: config.colorSecundario + "40" }}>
      {/* Header */}
      <header style={{ backgroundColor: config.colorPrimario }}>
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Building2 className="h-8 w-8 text-white/80" />
            <span className="text-white/80 font-semibold text-sm uppercase tracking-wider">{empresa.nombre}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{config.titulo}</h1>
          <p className="text-white/80 max-w-xl mx-auto text-sm leading-relaxed">{config.textoBienvenida}</p>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-5xl mx-auto px-6 -mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Buscar vacante..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 border-gray-200" />
            </div>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-44 border-gray-200"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroJornada} onValueChange={setFiltroJornada}>
              <SelectTrigger className="w-44 border-gray-200"><SelectValue placeholder="Tipo de jornada" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos los tipos</SelectItem>
                {Object.entries(TIPO_JORNADA_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Category pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setFiltroCategoria("todas")}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors text-white"
              style={{ backgroundColor: filtroCategoria === "todas" ? config.colorPrimario : "#e5e7eb", color: filtroCategoria === "todas" ? "white" : "#6b7280" }}
            >
              Todos
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setFiltroCategoria(c)}
                className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{ backgroundColor: filtroCategoria === c ? config.colorPrimario : "#e5e7eb", color: filtroCategoria === c ? "white" : "#6b7280" }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vacancy List */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <Briefcase className="h-10 w-10 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No hay vacantes disponibles en este momento</p>
            </div>
          )}
          {filtered.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-5 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setSelectedVacante(v)}
            >
              <div>
                <h3 className="text-lg font-bold" style={{ color: config.colorTexto }}>{v.puesto}</h3>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{v.ubicacion}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{TIPO_JORNADA_LABELS[v.tipoJornada]}</span>
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5 text-white group-hover:shadow-sm transition-shadow"
                style={{ backgroundColor: config.colorBoton }}
              >
                Ver vacante <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </main>

      {/* About section */}
      {config.textoSobre && (
        <section className="max-w-5xl mx-auto px-6 pb-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold mb-3" style={{ color: config.colorTexto }}>{config.tituloSobre}</h2>
            <p className="text-gray-600 leading-relaxed">{config.textoSobre}</p>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 text-center text-xs text-gray-400 border-t border-gray-200">
        Portal de empleo de {empresa.nombre} · Powered by BALLES HOSTELEROS
      </footer>

      {/* Inscription dialog */}
      <FormularioInscripcion
        open={!!inscripcionVacante}
        onOpenChange={(o) => !o && setInscripcionVacante(null)}
        vacante={inscripcionVacante}
        config={config}
      />
    </div>
  );
}
