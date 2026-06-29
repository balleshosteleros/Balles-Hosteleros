"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  CheckCircle2,
  Camera,
  Paperclip,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  esDniNieValido,
  esIbanValido,
  esSeguridadSocialValida,
  normalizarDniNie,
  normalizarIban,
  normalizarSeguridadSocial,
} from "@/features/rrhh/lib/documentacion-validacion";

interface Props {
  token: string;
  empresaSlug: string;
}

/** Campos cuyo número detecta la IA. */
type Campo = "dni_nie" | "iban" | "ss";

const TIPOS_IMG = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 10 * 1024 * 1024;

/** Estado de un documento adjunto (con detección IA si es imagen). */
interface DocState {
  file: File | null;
  /** "ok" si la IA detectó algo, "fallo" si no, "n/a" si es PDF/no procesado. */
  deteccion: "idle" | "procesando" | "ok" | "fallo" | "na";
}

const DOC_VACIO: DocState = { file: null, deteccion: "idle" };

/**
 * Bloque de subida de UN documento: botones "Hacer foto" / "Subir archivo".
 * Al adjuntar una imagen, dispara la detección IA (onImagen). Para PDF no hay IA.
 */
function SubidaDoc({
  id,
  label,
  ayuda,
  doc,
  onFile,
}: {
  id: string;
  label: string;
  ayuda?: string;
  doc: DocState;
  onFile: (f: File | null) => void;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label>{label} <span className="text-destructive">*</span></Label>
      {ayuda && <p className="text-[12px] text-muted-foreground -mt-1">{ayuda}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => camRef.current?.click()}>
          <Camera className="h-4 w-4 mr-1.5" /> Hacer foto
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          <Paperclip className="h-4 w-4 mr-1.5" /> Subir archivo
        </Button>
      </div>

      {doc.file && (
        <div className="flex items-center gap-2 text-sm">
          <span className="truncate text-foreground/80">{doc.file.name}</span>
          {doc.deteccion === "procesando" && (
            <span className="inline-flex items-center gap-1 text-muted-foreground shrink-0">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo…
            </span>
          )}
          {doc.deteccion === "ok" && (
            <span className="inline-flex items-center gap-1 text-emerald-600 shrink-0">
              <Sparkles className="h-3.5 w-3.5" /> Datos detectados
            </span>
          )}
          {doc.deteccion === "fallo" && (
            <span className="inline-flex items-center gap-1 text-amber-600 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" /> No se pudo leer
            </span>
          )}
        </div>
      )}

      {/* input de cámara: capture abre la cámara trasera en móvil */}
      <input
        ref={camRef}
        id={`${id}-cam`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={fileRef}
        id={`${id}-file`}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export function FormDocumentacionPublica({ token, empresaSlug }: Props) {
  const [dniAnverso, setDniAnverso] = useState<DocState>(DOC_VACIO);
  const [dniReverso, setDniReverso] = useState<DocState>(DOC_VACIO);
  const [docIban, setDocIban] = useState<DocState>(DOC_VACIO);
  const [docSs, setDocSs] = useState<DocState>(DOC_VACIO);

  // Números propuestos por la IA y validados/corregidos por la persona.
  const [dniNie, setDniNie] = useState("");
  const [iban, setIban] = useState("");
  const [ss, setSs] = useState("");

  // Datos personales adicionales del paso Documentación.
  const [fotoPerfil, setFotoPerfil] = useState<DocState>(DOC_VACIO);
  const [direccion, setDireccion] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");

  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /** Llama a la IA para proponer el número de un campo a partir de la imagen. */
  async function detectar(campo: Campo, file: File): Promise<void> {
    const fd = new FormData();
    fd.set("token", token);
    fd.set("campo", campo);
    fd.set("imagen", file);
    try {
      const res = await fetch("/api/documentacion/extraer", { method: "POST", body: fd });
      const data = (await res.json()) as { ok: boolean; valor?: string | null };
      const valor = data.ok ? data.valor ?? null : null;
      if (valor) {
        if (campo === "dni_nie") setDniNie(valor);
        else if (campo === "iban") setIban(valor);
        else if (campo === "ss") setSs(valor);
      }
      return marcarDeteccion(campo, valor ? "ok" : "fallo");
    } catch {
      return marcarDeteccion(campo, "fallo");
    }
  }

  function marcarDeteccion(campo: Campo, estado: DocState["deteccion"]) {
    if (campo === "dni_nie") setDniAnverso((d) => ({ ...d, deteccion: estado }));
    else if (campo === "iban") setDocIban((d) => ({ ...d, deteccion: estado }));
    else if (campo === "ss") setDocSs((d) => ({ ...d, deteccion: estado }));
  }

  /** Gestiona un archivo adjunto: valida tipo/tamaño y lanza IA si procede. */
  function onDocFile(
    setter: (d: DocState) => void,
    campo: Campo | null,
    f: File | null,
  ) {
    setError(null);
    if (!f) { setter(DOC_VACIO); return; }
    if (f.size > MAX_BYTES) { setError("El archivo supera 10MB"); return; }
    const esImg = TIPOS_IMG.has(f.type);
    const esPdf = f.type === "application/pdf";
    if (!esImg && !esPdf) { setError("Formato no admitido (usa foto o PDF)"); return; }

    // PDF o campo sin IA → solo adjuntar (el número se teclea a mano).
    if (!campo || esPdf) {
      setter({ file: f, deteccion: "na" });
      return;
    }
    setter({ file: f, deteccion: "procesando" });
    void detectar(campo, f);
  }

  function validar(): string | null {
    if (!dniAnverso.file) return "Adjunta el anverso de tu DNI/NIE";
    if (!dniReverso.file) return "Adjunta el reverso de tu DNI/NIE";
    if (!docSs.file) return "Adjunta el documento de la Seguridad Social";
    if (!fotoPerfil.file) return "Adjunta tu foto de perfil";
    if (!direccion.trim()) return "Indica tu dirección postal";
    if (!fechaNacimiento) return "Indica tu fecha de nacimiento";
    if (new Date(`${fechaNacimiento}T00:00:00`) >= new Date())
      return "La fecha de nacimiento no es válida";
    // El anverso del DNI con IA fallida obliga a rehacer la foto (regla acordada).
    if (dniAnverso.deteccion === "fallo")
      return "No hemos podido leer tu DNI/NIE. Vuelve a hacer la foto del anverso con buena luz.";
    if (docSs.deteccion === "fallo")
      return "No hemos podido leer el nº de la Seguridad Social. Vuelve a hacer la foto.";
    if (!esDniNieValido(dniNie)) return "Revisa tu DNI/NIE: no parece válido";
    if (!esIbanValido(iban)) return "Revisa tu IBAN: no parece válido";
    if (!esSeguridadSocialValida(ss)) return "Revisa tu nº de la Seguridad Social";
    return null;
  }

  function enviar() {
    setError(null);
    const err = validar();
    if (err) { setError(err); return; }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("token", token);
        fd.set("dni_nie", normalizarDniNie(dniNie));
        fd.set("iban", normalizarIban(iban));
        fd.set("num_seguridad_social", normalizarSeguridadSocial(ss));
        if (dniAnverso.file) fd.set("dni_anverso", dniAnverso.file);
        if (dniReverso.file) fd.set("dni_reverso", dniReverso.file);
        if (docIban.file) fd.set("doc_iban", docIban.file);
        if (docSs.file) fd.set("doc_ss", docSs.file);
        if (fotoPerfil.file) fd.set("foto_perfil", fotoPerfil.file);
        fd.set("direccion", direccion.trim());
        fd.set("fecha_nacimiento", fechaNacimiento);

        const res = await fetch("/api/documentacion", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Error al enviar");
        setEnviado(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  if (enviado) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500" />
        <div>
          <h2 className="text-xl font-semibold">¡Documentación enviada!</h2>
          <p className="text-muted-foreground mt-2">
            Gracias. Hemos recibido tu documentación correctamente. El equipo de Recursos
            Humanos continuará con tu incorporación.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/empleo/${empresaSlug}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Ir al portal de empleo
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); enviar(); }}
      className="rounded-lg border bg-card p-5 md:p-6 space-y-6"
    >
      {/* 1. DNI / NIE */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">1. DNI / NIE</h2>
        <p className="text-sm text-muted-foreground -mt-2">
          Adjunta las dos caras. Si eres extranjero/a, vale el pasaporte.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <SubidaDoc
            id="dni-anverso"
            label="Anverso (cara delantera)"
            doc={dniAnverso}
            onFile={(f) => onDocFile(setDniAnverso, "dni_nie", f)}
          />
          <SubidaDoc
            id="dni-reverso"
            label="Reverso (cara trasera)"
            doc={dniReverso}
            onFile={(f) => onDocFile(setDniReverso, null, f)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="num-dni">Número de DNI/NIE *</Label>
          <Input
            id="num-dni"
            value={dniNie}
            onChange={(e) => setDniNie(e.target.value.toUpperCase())}
            placeholder="Lo detectamos de tu foto; revísalo"
            autoComplete="off"
          />
        </div>
      </section>

      <hr className="border-border" />

      {/* 2. Cuenta bancaria (IBAN) */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">2. Cuenta bancaria (IBAN)</h2>
        <SubidaDoc
          id="doc-iban"
          label="Documento con tu IBAN"
          ayuda="Una foto o captura donde se vea el IBAN completo."
          doc={docIban}
          onFile={(f) => onDocFile(setDocIban, "iban", f)}
        />
        <div className="space-y-1.5">
          <Label htmlFor="num-iban">IBAN *</Label>
          <Input
            id="num-iban"
            value={iban}
            onChange={(e) => setIban(e.target.value.toUpperCase())}
            placeholder="ES00 0000 0000 0000 0000 0000"
            autoComplete="off"
          />
        </div>
      </section>

      <hr className="border-border" />

      {/* 3. Seguridad Social */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">3. Número de la Seguridad Social</h2>
        <SubidaDoc
          id="doc-ss"
          label="Documento de la Seguridad Social"
          ayuda="Por ejemplo, el documento de afiliación (NAF) o tu tarjeta sanitaria."
          doc={docSs}
          onFile={(f) => onDocFile(setDocSs, "ss", f)}
        />
        <div className="space-y-1.5">
          <Label htmlFor="num-ss">Nº de la Seguridad Social *</Label>
          <Input
            id="num-ss"
            value={ss}
            onChange={(e) => setSs(e.target.value)}
            placeholder="Lo detectamos de tu foto; revísalo"
            inputMode="numeric"
            autoComplete="off"
          />
        </div>
      </section>

      <hr className="border-border" />

      {/* 4. Tus datos personales */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">4. Tus datos</h2>
        <SubidaDoc
          id="foto-perfil"
          label="Foto de perfil"
          ayuda="Una foto reciente tipo carné, con la cara bien visible."
          doc={fotoPerfil}
          onFile={(f) => onDocFile(setFotoPerfil, null, f)}
        />
        <div className="space-y-1.5">
          <Label htmlFor="direccion">Dirección postal *</Label>
          <Input
            id="direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Calle, número, piso, código postal y localidad"
            autoComplete="street-address"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fecha-nac">Fecha de nacimiento *</Label>
          <Input
            id="fecha-nac"
            type="date"
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </section>

      <div className="rounded-md bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">
        Leemos los números automáticamente para ahorrarte tiempo, pero tú decides: revísalos
        y corrige lo que haga falta antes de enviar.
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 border border-destructive/20">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Al enviar aceptas el tratamiento de tus datos para gestionar tu incorporación.
        </p>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
          Confirmar y enviar
        </Button>
      </div>
    </form>
  );
}
