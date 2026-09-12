"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  presentarDenuncia,
  type CategoriaDenuncia,
  type EstadoDenuncia,
  type ModalidadDenuncia,
} from "@/features/mi-panel/actions/denuncias-actions";
import { SelectorFecha } from "@/components/ui/selector-fecha";

export const CATEGORIA_LABEL: Record<CategoriaDenuncia, string> = {
  acoso_laboral: "Acoso laboral",
  discriminacion: "Discriminación",
  seguridad_salud: "Seguridad y salud en el trabajo",
  irregularidad: "Irregularidad o incumplimiento",
  trato_cliente: "Incidente con un cliente",
  queja_general: "Queja general",
  otro: "Otro",
};

/**
 * Cómo se llama cada estado de una queja. Se nombra aquí y solo aquí: la lista
 * del móvil y la del panel dicen lo mismo palabra por palabra.
 */
export const DENUNCIA_ESTADO_LABEL: Record<EstadoDenuncia, string> = {
  recibida: "Recibida",
  en_investigacion: "En investigación",
  informacion_solicitada: "Información solicitada",
  resuelta: "Resuelta",
  archivada: "Archivada",
};

const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as CategoriaDenuncia[];

/** Mismo estilo de tarjeta que el paso «tipo» de una solicitud. */
const TARJETA =
  "text-left p-4 rounded-lg border transition-colors hover:border-primary hover:bg-primary/5 active:border-blue-600 active:bg-blue-50 active:text-blue-700";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}

export function DenunciaModal({ open, onOpenChange, onCreated }: Props) {
  const [modalidad, setModalidad] = useState<ModalidadDenuncia | null>(null);
  const [categoria, setCategoria] = useState<CategoriaDenuncia>("queja_general");
  const [asunto, setAsunto] = useState("");
  const [relato, setRelato] = useState("");
  const [fechaHechos, setFechaHechos] = useState("");
  const [lugar, setLugar] = useState("");
  const [implicadas, setImplicadas] = useState("");
  const [testigos, setTestigos] = useState("");
  const [enviando, setEnviando] = useState(false);

  function cerrar() {
    onOpenChange(false);
    // Se limpia al cerrar para que la próxima apertura entre en blanco.
    setTimeout(() => {
      setModalidad(null);
      setCategoria("queja_general");
      setAsunto(""); setRelato(""); setFechaHechos("");
      setLugar(""); setImplicadas(""); setTestigos("");
    }, 200);
  }

  async function enviar() {
    if (!modalidad || !asunto.trim() || !relato.trim()) return;
    setEnviando(true);
    const res = await presentarDenuncia({
      modalidad,
      categoria,
      asunto,
      relato,
      fecha_hechos: fechaHechos || null,
      lugar,
      personas_implicadas: implicadas,
      testigos,
    });
    setEnviando(false);

    if (!res.ok) {
      toast.error(res.error ?? "No se pudo presentar");
      return;
    }
    onCreated?.();
    toast.success("Queja presentada. RRHH la revisará.");
    cerrar();
  }

  // ─── Paso 1: elegir modalidad ───────────────────────────────────────────
  if (!modalidad) {
    return (
      <Dialog open={open} onOpenChange={cerrar}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Queja o denuncia</DialogTitle>
            <DialogDescription>
              Único canal válido: no se tramita nada por correo, teléfono ni de
              palabra. ¿Cómo quieres presentarla?
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <button type="button" onClick={() => setModalidad("nominal")} className={TARJETA}>
              <div className="font-semibold">En mi nombre</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Tu nombre solo lo ve RRHH. Es la única vía que permite sancionar.
              </div>
            </button>
            <button type="button" onClick={() => setModalidad("anonima")} className={TARJETA}>
              <div className="font-semibold">Anónima</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                RRHH ve la queja, no quién la puso. No permite sancionar: sirve de
                aviso.
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Paso 2: el formulario ──────────────────────────────────────────────
  const esAnonima = modalidad === "anonima";

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setModalidad(null)}
              aria-label="Volver"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            Queja o denuncia
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">
              {esAnonima ? "Anónima" : "En mi nombre"}
            </span>
            {esAnonima
              ? " · RRHH no verá tu nombre. Sin una persona a la que dar audiencia no se puede sancionar, así que sirve de aviso."
              : " · tu nombre solo lo ve RRHH. Permite investigar y, si se confirma, tomar medidas. No se admiten represalias."}
          </DialogDescription>
          <button
            type="button"
            onClick={() => setModalidad(esAnonima ? "nominal" : "anonima")}
            className="self-start text-xs font-medium text-muted-foreground underline"
          >
            {esAnonima ? "Prefiero presentarla en mi nombre" : "Prefiero presentarla de forma anónima"}
          </button>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Categoría</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaDenuncia)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{CATEGORIA_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha de los hechos</Label>
              <SelectorFecha value={fechaHechos} onChange={setFechaHechos} />
            </div>
          </div>

          <div>
            <Label>Asunto</Label>
            <Input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Resume en una línea qué ocurre" />
          </div>

          <div>
            <Label>Qué ha pasado</Label>
            <Textarea
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
              rows={6}
              placeholder="Cuenta los hechos con el mayor detalle posible: qué pasó, cuándo y cómo. Cuanto más concreto, mejor se puede investigar."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Lugar</Label>
              <Input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Local, zona o turno" />
            </div>
            <div>
              <Label>Personas implicadas</Label>
              <Input value={implicadas} onChange={(e) => setImplicadas(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div>
            <Label>Testigos</Label>
            <Input value={testigos} onChange={(e) => setTestigos(e.target.value)} placeholder="Quién más pudo verlo (opcional)" />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            onClick={enviar}
            disabled={!asunto.trim() || !relato.trim() || enviando}
            className="active:bg-blue-600"
          >
            {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar queja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
