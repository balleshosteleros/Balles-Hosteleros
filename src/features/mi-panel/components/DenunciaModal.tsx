"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, ShieldCheck, UserRound, VenetianMask } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  presentarDenuncia,
  type CategoriaDenuncia,
  type ModalidadDenuncia,
} from "@/features/mi-panel/actions/denuncias-actions";

export const CATEGORIA_LABEL: Record<CategoriaDenuncia, string> = {
  acoso_laboral: "Acoso laboral",
  discriminacion: "Discriminación",
  seguridad_salud: "Seguridad y salud en el trabajo",
  irregularidad: "Irregularidad o incumplimiento",
  trato_cliente: "Incidente con un cliente",
  queja_general: "Queja general",
  otro: "Otro",
};

const CATEGORIAS = Object.keys(CATEGORIA_LABEL) as CategoriaDenuncia[];

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
  const [codigo, setCodigo] = useState<string | null>(null);

  function cerrar() {
    onOpenChange(false);
    // Se limpia al cerrar para que la próxima apertura entre en blanco.
    setTimeout(() => {
      setModalidad(null);
      setCategoria("queja_general");
      setAsunto(""); setRelato(""); setFechaHechos("");
      setLugar(""); setImplicadas(""); setTestigos("");
      setCodigo(null);
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

    if (res.codigoSeguimiento) {
      // Se muestra una sola vez: no se puede recuperar después.
      setCodigo(res.codigoSeguimiento);
      return;
    }
    toast.success("Comunicación presentada. Recursos Humanos la revisará.");
    cerrar();
  }

  // ─── Pantalla final del código anónimo ──────────────────────────────────
  if (codigo) {
    return (
      <Dialog open={open} onOpenChange={cerrar}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-emerald-600" />
              Comunicación anónima presentada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Guarda este código. Es la única forma de consultar el estado de tu
              comunicación, y <strong>no se puede volver a mostrar</strong>: no queda
              guardado en ningún sitio que permita recuperarlo.
            </p>
            {/* El código no debe desbordar en pantallas estrechas: se permite
                partir y el tamaño sube solo a partir de sm. */}
            <div className="rounded-lg border-2 border-dashed p-4 text-center">
              <p className="break-all font-mono text-lg font-bold tracking-wider sm:text-xl">
                {codigo}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(codigo);
                toast.success("Código copiado");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copiar código
            </Button>
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="text-xs text-amber-900">
                Recuerda: al ser anónima, esta comunicación sirve como señal de alerta y
                para estadística, pero no permite abrir un expediente sancionador.
              </p>
            </div>
          </div>
          <div className="flex justify-end mt-2">
            <Button variant="primary" onClick={cerrar}>Ya lo he guardado</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Paso 1: elegir modalidad ───────────────────────────────────────────
  if (!modalidad) {
    return (
      <Dialog open={open} onOpenChange={cerrar}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Presentar una queja o denuncia</DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">
              Este es el <strong>único canal válido</strong> para quejas y denuncias.
              No se tramitan por correo, por teléfono ni de palabra: solo lo que entra
              aquí queda registrado y lo revisa siempre Recursos Humanos.
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Elige cómo quieres presentarla. La diferencia es importante:
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setModalidad("nominal")}
              className="rounded-lg border-2 p-4 text-left transition-colors hover:border-primary"
            >
              <UserRound className="h-6 w-6 text-primary" />
              <p className="mt-2 font-semibold">En mi nombre</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Consta quién la presenta. Permite investigar a fondo, escuchar a las dos
                partes y, si se confirma, <strong>tomar medidas disciplinarias</strong>.
                Tu identidad se trata de forma confidencial: solo accede Recursos Humanos.
              </p>
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Es la vía que permite resolver de verdad la situación.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setModalidad("anonima")}
              className="rounded-lg border-2 p-4 text-left transition-colors hover:border-amber-400"
            >
              <VenetianMask className="h-6 w-6 text-amber-600" />
              <p className="mt-2 font-semibold">De forma anónima</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No queda ningún dato tuyo. Recibirás un código para consultar el estado.
              </p>
              <p className="mt-2 text-xs font-medium text-amber-800">
                Vale solo como estadística y señal de alerta: no permite sancionar.
              </p>
            </button>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="flex gap-2 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Por qué la anónima no permite sancionar:</strong> para tomar
                medidas contra alguien hay que darle la oportunidad de defenderse frente
                a lo que se le imputa. Si no hay una persona identificada al otro lado,
                no puede haber contradicción entre ambas partes, y una sanción impuesta
                así sería nula. Por eso las anónimas se registran, se estudian y sirven
                para detectar problemas, pero no pueden fundamentar un expediente.
              </span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Paso 2: el formulario ──────────────────────────────────────────────
  const esAnonima = modalidad === "anonima";

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {esAnonima ? <VenetianMask className="h-5 w-5 text-amber-600" /> : <ShieldCheck className="h-5 w-5 text-primary" />}
            {esAnonima ? "Comunicación anónima" : "Comunicación en mi nombre"}
          </DialogTitle>
        </DialogHeader>

        <div
          className={`rounded-lg border p-3 ${esAnonima ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}
        >
          <p className={`text-xs ${esAnonima ? "text-amber-900" : "text-emerald-900"}`}>
            {esAnonima
              ? "No se guardará ningún dato que permita identificarte. Al no poder darse audiencia a la otra parte, esta comunicación no podrá dar lugar a sanciones: se usará como señal de alerta y para estadística."
              : "Tu nombre queda registrado y solo lo ve Recursos Humanos. Esto permite investigar con garantías y, si se confirman los hechos, adoptar medidas. No se admiten represalias por presentar una comunicación."}
          </p>
          <button
            type="button"
            onClick={() => setModalidad(esAnonima ? "nominal" : "anonima")}
            className="mt-2 text-xs font-medium underline"
          >
            {esAnonima ? "Prefiero presentarla en mi nombre" : "Prefiero presentarla de forma anónima"}
          </button>
        </div>

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
              <Input type="date" value={fechaHechos} onChange={(e) => setFechaHechos(e.target.value)} />
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

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setModalidad(null)}>Atrás</Button>
          <Button
            variant="primary"
            onClick={enviar}
            disabled={!asunto.trim() || !relato.trim() || enviando}
          >
            {enviando ? "Enviando…" : "Presentar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
