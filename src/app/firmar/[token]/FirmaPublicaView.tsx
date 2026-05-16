"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const VisorPdfInteractivo = dynamic(
  () => import("./VisorPdfInteractivo").then((m) => m.VisorPdfInteractivo),
  { ssr: false },
);
const VisorPdfLimpio = dynamic(
  () => import("./VisorPdfLimpio").then((m) => m.VisorPdfLimpio),
  { ssr: false },
);
import type { PosicionFirma } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  FileSignature,
  PenLine,
  CheckCircle2,
  X,
  Eraser,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  solicitarOTP,
  validarOTP,
  firmarDocumento,
  rechazarDocumento,
  getEstadoFirma,
  type AbrirDocumentoResult,
} from "./actions";

type Documento = Extract<AbrirDocumentoResult, { ok: true }>["documento"];

type Etapa = "leer" | "otp" | "firmar" | "firmado" | "rechazado";

const MODALIDAD_LABEL: Record<Documento["modalidad"], string> = {
  click_to_sign: "Click-to-sign",
  email_otp: "Email + código",
  manuscrita_digital: "Firma manuscrita",
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FirmaPublicaView({
  documento,
  token,
}: {
  documento: Documento;
  token: string;
}) {
  const [etapa, setEtapa] = useState<Etapa>("leer");
  const [acepto, setAcepto] = useState(false);
  const [enviandoOtp, setEnviandoOtp] = useState(false);
  const [destinoOtp, setDestinoOtp] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [validando, setValidando] = useState(false);
  const [firmando, setFirmando] = useState(false);
  const [descargaUrl, setDescargaUrl] = useState<string | null>(null);
  const [showRechazar, setShowRechazar] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [rechazando, setRechazando] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [trazoVacio, setTrazoVacio] = useState(true);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  }, []);

  useEffect(() => {
    if (etapa === "firmar" && documento.modalidad === "manuscrita_digital") {
      setupCanvas();
    }
  }, [etapa, documento.modalidad, setupCanvas]);

  useEffect(() => {
    if (etapa === "firmado" || etapa === "rechazado") return;
    let activo = true;
    const id = setInterval(async () => {
      const res = await getEstadoFirma(token);
      if (!activo) return;
      if (res.estado === "firmado") {
        setDescargaUrl(res.descargaUrl ?? null);
        setEtapa("firmado");
        toast.success("Documento firmado desde otro dispositivo");
      } else if (res.estado === "rechazado") {
        setEtapa("rechazado");
      }
    }, 3000);
    return () => {
      activo = false;
      clearInterval(id);
    };
  }, [etapa, token]);

  const limpiarCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    setTrazoVacio(true);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 && e.pressure === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    if (trazoVacio) setTrazoVacio(false);
  };

  async function pedirOTP() {
    setEnviandoOtp(true);
    const res = await solicitarOTP(token);
    setEnviandoOtp(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDestinoOtp(res.destinoEnmascarado);
    setEtapa("otp");
    toast.success(`Código enviado a ${res.destinoEnmascarado}`);
  }

  async function comprobarOTP() {
    setValidando(true);
    const res = await validarOTP(token, codigo);
    setValidando(false);
    if (!res.ok) {
      toast.error(res.error);
      if (res.bloqueado) setEtapa("leer");
      return;
    }
    setEtapa("firmar");
  }

  async function ejecutarFirma() {
    let trazoBase64: string | null = null;
    if (documento.modalidad === "manuscrita_digital") {
      // En manuscrita usamos VisorPdfInteractivo (ejecutarFirmaManuscrita).
      // Esta función queda para click_to_sign y email_otp.
      toast.error("Usa el visor de firma con la firma posicionada.");
      return;
    }

    setFirmando(true);
    const res = await firmarDocumento({ token, trazoFirmaBase64: trazoBase64 });
    setFirmando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDescargaUrl(res.descargaUrl);
    setEtapa("firmado");
    toast.success("Documento firmado correctamente");
  }

  async function ejecutarFirmaManuscrita(data: { trazoBase64: string; posicion: PosicionFirma }) {
    setFirmando(true);
    const res = await firmarDocumento({
      token,
      trazoFirmaBase64: data.trazoBase64,
      posicionFirma: data.posicion,
    });
    setFirmando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setDescargaUrl(res.descargaUrl);
    setEtapa("firmado");
    toast.success("Documento firmado correctamente");
  }

  async function ejecutarRechazo() {
    setRechazando(true);
    const res = await rechazarDocumento(token, motivoRechazo);
    setRechazando(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setShowRechazar(false);
    setEtapa("rechazado");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-indigo-600" />
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                {documento.empresa.nombre}
              </div>
              <div className="text-xs text-zinc-500">Firma electrónica</div>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 border-indigo-200 bg-indigo-50 text-indigo-700">
            <ShieldCheck className="h-3 w-3" />
            Firma Digital
          </Badge>
        </div>
      </header>

      <main className={
        etapa === "firmar" && documento.modalidad === "manuscrita_digital"
          ? "max-w-7xl mx-auto px-6 py-6 space-y-4"
          : "max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6"
      }>
        {etapa === "firmar" && documento.modalidad === "manuscrita_digital" ? (
          <>
            <div className="px-1 pb-2">
              <div className="text-sm font-semibold text-zinc-900">{documento.titulo}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                Dibuja tu firma a la derecha y arrástrala al PDF.
              </div>
            </div>
            <VisorPdfInteractivo
              pdfUrl={documento.pdfUrl}
              onConfirm={ejecutarFirmaManuscrita}
              submitting={firmando}
            />
          </>
        ) : (
        <>
        <div>
          <div className="text-sm font-semibold text-zinc-900 mb-3 px-1">
            {documento.titulo}
          </div>
          <div className="max-h-[760px] overflow-auto rounded-lg bg-white">
            <VisorPdfLimpio pdfUrl={documento.pdfUrl} width={640} />
          </div>
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-zinc-900">Datos del envío</h2>
            <dl className="mt-3 text-sm space-y-2">
              <Info label="Para" value={documento.empleado.nombre} />
              <Info label="Modalidad" value={MODALIDAD_LABEL[documento.modalidad]} />
              <Info label="Enviado por" value={documento.enviadoPor} />
              <Info label="Enviado el" value={formatFecha(documento.enviadoEn)} />
              <Info label="Caduca el" value={formatFecha(documento.expiraEn)} />
            </dl>
          </Card>

          {etapa === "leer" && (
            <Card className="p-5 space-y-3">
              <label className="flex items-start gap-2 text-sm text-zinc-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acepto}
                  onChange={(e) => setAcepto(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  He leído el documento y declaro que la información que contiene
                  es correcta.
                </span>
              </label>
              <Button
                onClick={pedirOTP}
                disabled={!acepto || enviandoOtp}
                className="w-full"
                variant="primary"
              >
                <PenLine className="h-4 w-4 mr-1" />
                {enviandoOtp ? "Enviando código…" : "Continuar a firmar"}
              </Button>
              <button
                onClick={() => setShowRechazar(true)}
                className="text-xs text-rose-600 hover:underline w-full text-center"
              >
                Rechazar firma
              </button>
            </Card>
          )}

          {etapa === "otp" && (
            <Card className="p-5 space-y-3">
              <div className="text-sm text-zinc-700">
                Hemos enviado un código de 6 dígitos a{" "}
                <strong>{destinoOtp ?? "tu email"}</strong>. Introdúcelo para
                confirmar tu identidad.
              </div>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
              <Button
                onClick={comprobarOTP}
                disabled={codigo.length !== 6 || validando}
                className="w-full"
                variant="primary"
              >
                {validando ? "Validando…" : "Validar código"}
              </Button>
              <button
                onClick={pedirOTP}
                className="text-xs text-zinc-500 hover:underline w-full text-center"
              >
                Reenviar código
              </button>
            </Card>
          )}

          {etapa === "firmar" && (
            <Card className="p-5 space-y-3">
              <h2 className="text-sm font-semibold text-zinc-900">
                Último paso: firmar
              </h2>
              {documento.modalidad === "manuscrita_digital" ? (
                <>
                  <div className="text-xs text-zinc-500">
                    Dibuja tu firma con el dedo o el ratón en el recuadro.
                  </div>
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      className="w-full h-40 bg-white border-2 border-dashed border-zinc-300 rounded-lg touch-none"
                    />
                    <button
                      onClick={limpiarCanvas}
                      className="absolute top-2 right-2 text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1 bg-white/80 backdrop-blur px-2 py-1 rounded"
                    >
                      <Eraser className="h-3 w-3" /> Borrar
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-700">
                  Al pulsar <strong>Firmar ahora</strong> tu firma electrónica
                  quedará registrada con timestamp, IP y hash criptográfico
                  conforme a eIDAS.
                </div>
              )}
              <Button
                onClick={ejecutarFirma}
                disabled={firmando}
                className="w-full"
                variant="primary"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {firmando ? "Firmando…" : "Firmar ahora"}
              </Button>
            </Card>
          )}

          {etapa === "firmado" && (
            <Card className="p-5 space-y-3 border-emerald-200 bg-emerald-50">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="text-sm font-semibold">Documento firmado</h2>
              </div>
              <p className="text-sm text-zinc-700">
                Recibirás una copia firmada en tu email. También puedes
                descargarla ahora:
              </p>
              {descargaUrl && (
                <a
                  href={descargaUrl}
                  download
                  className="inline-flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-md text-sm font-medium"
                >
                  <Download className="h-4 w-4" /> Descargar copia firmada
                </a>
              )}
            </Card>
          )}

          {etapa === "rechazado" && (
            <Card className="p-5 space-y-2 border-rose-200 bg-rose-50">
              <div className="flex items-center gap-2 text-rose-700">
                <X className="h-5 w-5" />
                <h2 className="text-sm font-semibold">Firma rechazada</h2>
              </div>
              <p className="text-sm text-zinc-700">
                Has rechazado la firma de este documento. RRHH ha sido informado.
              </p>
            </Card>
          )}
        </aside>
        </>
        )}
      </main>

      <Dialog open={showRechazar} onOpenChange={setShowRechazar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rechazar firma</DialogTitle>
            <DialogDescription>
              Esta acción cierra el documento. Puedes indicar un motivo
              (opcional) para que RRHH lo tenga en cuenta.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivoRechazo}
            onChange={(e) => setMotivoRechazo(e.target.value)}
            rows={3}
            placeholder="Motivo (opcional)…"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRechazar(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={ejecutarRechazo}
              disabled={rechazando}
            >
              {rechazando ? "Rechazando…" : "Rechazar firma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </dt>
      <dd className="text-right text-zinc-900">{value}</dd>
    </div>
  );
}
