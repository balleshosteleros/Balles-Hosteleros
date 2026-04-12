"use client";

import { useState } from "react";
import {
  Video,
  FileText,
  Play,
  Sparkles,
  Loader2,
  Calendar,
  Users,
  Clock,
  Plus,
  Search,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Reunion = {
  id: string;
  titulo: string;
  fecha: string;
  duracion: string;
  participantes: string[];
  meetLink?: string;
  grabacionUrl?: string;
  notas: string;
  resumenIA?: string;
  generandoResumen: boolean;
};

const SEED: Reunion[] = [
  {
    id: "r1",
    titulo: "Reunión semanal de gerencia",
    fecha: "2026-04-11",
    duracion: "45 min",
    participantes: ["Iván", "Pablo", "Marta"],
    meetLink: "https://meet.google.com/abc-defg-hij",
    notas: "Revisión ratios, pendiente: pedir presupuesto frigorífico nuevo.",
    resumenIA:
      "Se revisaron los ratios de la semana: costes de materia prima un 2% por encima. Pablo reportó que el frigorífico de cocina necesita reemplazo (presupuesto en curso). Marta confirmó que las reservas del fin de semana están al 90%. Acción: Iván pide presupuesto a Frigoríficos Costa antes del jueves.",
    generandoResumen: false,
  },
  {
    id: "r2",
    titulo: "Cata nuevos platos primavera",
    fecha: "2026-04-10",
    duracion: "1h 20 min",
    participantes: ["Chef", "Iván", "Laura", "Equipo sala"],
    notas: "",
    generandoResumen: false,
  },
];

export function ReunionesView() {
  const [reuniones, setReuniones] = useState<Reunion[]>(SEED);
  const [busqueda, setBusqueda] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    titulo: "",
    fecha: new Date().toISOString().slice(0, 10),
    participantes: "",
    notas: "",
    meetLink: "",
  });
  const [detalle, setDetalle] = useState<Reunion | null>(null);

  const filtradas = busqueda.trim()
    ? reuniones.filter(
        (r) =>
          r.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
          r.participantes.some((p) =>
            p.toLowerCase().includes(busqueda.toLowerCase()),
          ),
      )
    : reuniones;

  function crear() {
    if (!form.titulo.trim()) {
      toast.error("Falta el título");
      return;
    }
    const nueva: Reunion = {
      id: `r-${Date.now()}`,
      titulo: form.titulo.trim(),
      fecha: form.fecha,
      duracion: "—",
      participantes: form.participantes
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      meetLink: form.meetLink.trim() || undefined,
      notas: form.notas.trim(),
      generandoResumen: false,
    };
    setReuniones((prev) => [nueva, ...prev]);
    setShowNew(false);
    setForm({
      titulo: "",
      fecha: new Date().toISOString().slice(0, 10),
      participantes: "",
      notas: "",
      meetLink: "",
    });
    toast.success("Reunión registrada");
  }

  async function generarResumen(id: string) {
    setReuniones((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, generandoResumen: true } : r,
      ),
    );

    const reunion = reuniones.find((r) => r.id === id);
    if (!reunion) return;

    try {
      const res = await fetch("/api/soporte/ayuda-rapida", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pregunta: `Resume esta reunión en 3-5 puntos clave con acciones a tomar. Título: ${reunion.titulo}. Fecha: ${reunion.fecha}. Participantes: ${reunion.participantes.join(", ")}. Notas: ${reunion.notas || "Sin notas disponibles"}`,
        }),
      });
      const data = await res.json();
      const resumen = data.texto || "No se pudo generar el resumen.";

      setReuniones((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, resumenIA: resumen, generandoResumen: false }
            : r,
        ),
      );
      if (detalle?.id === id) {
        setDetalle((prev) =>
          prev
            ? { ...prev, resumenIA: resumen, generandoResumen: false }
            : prev,
        );
      }
      toast.success("Resumen generado");
    } catch {
      setReuniones((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, generandoResumen: false } : r,
        ),
      );
      toast.error("No se pudo generar el resumen");
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setShowNew(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nueva reunión
        </Button>
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar reunión o participante…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {filtradas.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No hay reuniones registradas.
            </CardContent>
          </Card>
        )}
        {filtradas.map((r) => (
          <Card
            key={r.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => setDetalle(r)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 rounded-lg bg-indigo-100 p-2 text-indigo-600 dark:bg-indigo-950/40">
                    <Video className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {r.titulo}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {r.fecha}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {r.duracion}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />{" "}
                        {r.participantes.join(", ")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.meetLink && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Video className="h-3 w-3" /> Meet
                    </Badge>
                  )}
                  {r.resumenIA && (
                    <Badge className="bg-indigo-100 text-indigo-700 text-[10px] border-0">
                      <Sparkles className="mr-0.5 h-3 w-3" /> Resumen IA
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog nueva reunión */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar reunión</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Reunión semanal gerencia"
              />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              />
            </div>
            <div>
              <Label>Participantes (separados por coma)</Label>
              <Input
                value={form.participantes}
                onChange={(e) =>
                  setForm({ ...form, participantes: e.target.value })
                }
                placeholder="Iván, Marta, Pablo"
              />
            </div>
            <div>
              <Label>Link Google Meet (opcional)</Label>
              <Input
                value={form.meetLink}
                onChange={(e) =>
                  setForm({ ...form, meetLink: e.target.value })
                }
                placeholder="https://meet.google.com/..."
              />
            </div>
            <div>
              <Label>Notas</Label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                placeholder="Temas tratados, decisiones, pendientes…"
                className="mt-1 min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancelar
            </Button>
            <Button onClick={crear}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalle */}
      <Dialog open={!!detalle} onOpenChange={(o) => !o && setDetalle(null)}>
        {detalle && (
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detalle.titulo}</DialogTitle>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {detalle.fecha}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {detalle.duracion}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />{" "}
                  {detalle.participantes.join(", ")}
                </span>
              </div>
            </DialogHeader>

            {detalle.meetLink && (
              <a
                href={detalle.meetLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
              >
                <Video className="h-4 w-4" /> Abrir Google Meet
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            {detalle.notas && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Notas
                </p>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap text-foreground">
                  {detalle.notas}
                </div>
              </div>
            )}

            {/* Resumen IA */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Resumen con IA
                </p>
                {!detalle.resumenIA && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generarResumen(detalle.id)}
                    disabled={detalle.generandoResumen}
                  >
                    {detalle.generandoResumen ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                    )}
                    Generar resumen
                  </Button>
                )}
              </div>
              {detalle.resumenIA ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 text-sm whitespace-pre-wrap text-foreground dark:border-indigo-900/50 dark:bg-indigo-950/30">
                  {detalle.resumenIA}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {detalle.generandoResumen
                    ? "Generando…"
                    : "Pulsa el botón para generar un resumen automático con IA."}
                </p>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
