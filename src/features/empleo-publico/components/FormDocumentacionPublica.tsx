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
  Trash2,
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
type Campo = "dni_nie" | "dni_reverso" | "iban" | "ss";

const TIPOS_IMG = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Comprime una imagen en el navegador antes de enviarla. Vercel limita el cuerpo
 * total de la petición a ~4,5 MB, y son 5 documentos: si cada foto de móvil pesa
 * varios MB, el envío se rechaza con 413. Reducimos cada imagen a máx. 1600px de
 * lado y calidad JPEG 0,72 (queda nítida para leerla, pero pesa ~200-500 KB).
 * Los PDF y las imágenes ya pequeñas se dejan tal cual.
 */
async function comprimirImagen(file: File): Promise<File> {
  if (file.type === "application/pdf") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= 900 * 1024) return file; // ya es pequeña
  try {
    const bitmap = await createImageBitmap(file);
    const maxLado = 1600;
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.72),
    );
    if (!blob || blob.size >= file.size) return file; // no mejoró
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // si algo falla, se envía el original
  }
}

/** Estado de un documento adjunto (con detección IA si es imagen). */
interface DocState {
  file: File | null;
  /** "ok" si la IA detectó algo, "fallo" si no, "n/a" si es PDF/no procesado. */
  deteccion: "idle" | "procesando" | "ok" | "fallo" | "na" | "ajeno";
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
        <div className="group flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-sm">
          <span className="truncate text-foreground/80">{doc.file.name}</span>
          {doc.deteccion === "procesando" && (
            <span className="inline-flex items-center gap-1 text-muted-foreground shrink-0">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo el documento…
            </span>
          )}
          {doc.deteccion === "ok" && (
            <span className="inline-flex items-center gap-1 text-emerald-600 shrink-0">
              <Sparkles className="h-3.5 w-3.5" /> Datos detectados
            </span>
          )}
          {doc.deteccion === "fallo" && (
            <span className="inline-flex items-center gap-1 text-amber-600 shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" /> No hemos leído el número: revísalo abajo (el documento queda adjuntado)
            </span>
          )}
          {doc.deteccion === "ajeno" && (
            <span className="inline-flex items-center gap-1 text-destructive shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" /> A nombre de otra persona
            </span>
          )}
          {/* Papelera para quitar el documento y subir otro. En móvil siempre
              visible; en escritorio aparece al pasar el ratón por encima. */}
          <button
            type="button"
            onClick={() => onFile(null)}
            aria-label="Quitar este documento"
            title="Quitar y subir otro"
            className="ml-auto shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
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
  const errorRef = useRef<HTMLDivElement>(null);

  /** Muestra un error y hace scroll hasta él para que el candidato lo vea siempre. */
  function mostrarError(msg: string) {
    setError(msg);
    // Espera al render y desplaza el aviso al centro de la pantalla.
    setTimeout(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  /** Llama a la IA para proponer el número de un campo a partir de la imagen. */
  async function detectar(campo: Campo, file: File): Promise<void> {
    const fd = new FormData();
    fd.set("token", token);
    fd.set("campo", campo);
    fd.set("imagen", file);
    try {
      const res = await fetch("/api/documentacion/extraer", { method: "POST", body: fd });
      const data = (await res.json()) as {
        ok: boolean; valor?: string | null; fecha_nacimiento?: string | null; direccion?: string | null;
        titular_dni?: string | null; titular_nombre?: string | null;
      };
      const valor = data.ok ? data.valor ?? null : null;
      if (valor) {
        if (campo === "dni_nie") setDniNie(valor);
        else if (campo === "iban") setIban(valor);
        else if (campo === "ss") setSs(valor);
      }
      // Del DNI (anverso o reverso) sacamos fecha de nacimiento y dirección. En el
      // DNI español la DIRECCIÓN está en el REVERSO; la fecha en el anverso. Se
      // rellenan solo si estaban vacíos; el candidato puede corregirlos.
      if (campo === "dni_nie" || campo === "dni_reverso") {
        if (data.fecha_nacimiento && !fechaNacimiento) setFechaNacimiento(data.fecha_nacimiento);
        if (data.direccion && !direccion.trim()) setDireccion(data.direccion);
      }
      // Verificación de titular: la captura de SS/IBAN debe llevar el MISMO DNI
      // que el documento de identidad. Si la IA leyó un DNI en el documento y NO
      // coincide con el del DNI aportado, se marca como "ajeno" (bloquea el envío).
      if ((campo === "iban" || campo === "ss") && dniNie.trim()) {
        const titular = data.titular_dni ? normalizarDniNie(data.titular_dni) : "";
        if (titular && titular !== normalizarDniNie(dniNie)) {
          if (campo === "iban") setDocIban((d) => ({ ...d, deteccion: "ajeno" }));
          else setDocSs((d) => ({ ...d, deteccion: "ajeno" }));
          return;
        }
      }
      // El reverso se considera "ok" si leyó la dirección (no tiene número propio).
      if (campo === "dni_reverso") {
        return marcarDeteccion(campo, data.direccion ? "ok" : "na");
      }
      return marcarDeteccion(campo, valor ? "ok" : "fallo");
    } catch {
      return marcarDeteccion(campo, "fallo");
    }
  }

  function marcarDeteccion(campo: Campo, estado: DocState["deteccion"]) {
    if (campo === "dni_nie") setDniAnverso((d) => ({ ...d, deteccion: estado }));
    else if (campo === "dni_reverso") setDniReverso((d) => ({ ...d, deteccion: estado }));
    else if (campo === "iban") setDocIban((d) => ({ ...d, deteccion: estado }));
    else if (campo === "ss") setDocSs((d) => ({ ...d, deteccion: estado }));
  }

  /** Gestiona un archivo adjunto: valida tipo/tamaño y lanza IA si procede. */
  async function onDocFile(
    setter: (d: DocState) => void,
    campo: Campo | null,
    fRaw: File | null,
  ) {
    setError(null);
    if (!fRaw) {
      // Quitar el documento: limpia el archivo y el número autodetectado de ese campo.
      setter(DOC_VACIO);
      if (campo === "dni_nie") setDniNie("");
      else if (campo === "iban") setIban("");
      else if (campo === "ss") setSs("");
      return;
    }
    if (fRaw.size > MAX_BYTES) { setError("El archivo supera 10MB"); return; }
    const esImg = TIPOS_IMG.has(fRaw.type);
    const esPdf = fRaw.type === "application/pdf";
    if (!esImg && !esPdf) { setError("Formato no admitido (usa foto o PDF)"); return; }

    // Comprime las imágenes grandes para no superar el límite de subida de Vercel.
    const f = await comprimirImagen(fRaw);

    // Campo sin IA (foto de perfil, reverso del DNI) → solo adjuntar.
    if (!campo) {
      setter({ file: f, deteccion: "na" });
      return;
    }
    // DNI, IBAN y SS (imagen o PDF): la IA intenta leer el número.
    setter({ file: f, deteccion: "procesando" });
    void detectar(campo, f);
  }

  /** Devuelve la fecha en formato ISO AAAA-MM-DD, sea cual sea el formato de entrada. */
  function normalizarFechaISO(v: string): string {
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // ya es ISO
    // dd/mm/yyyy o dd-mm-yyyy (formatos que iOS puede devolver en algunos casos).
    const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v.trim());
    if (m) {
      const [, d, mo, y] = m;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // Último recurso: que el navegador lo parsee y lo pasamos a ISO.
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return v;
  }

  function validar(): string | null {
    if (!dniAnverso.file) return "Adjunta el anverso de tu DNI/NIE";
    if (!dniReverso.file) return "Adjunta el reverso de tu DNI/NIE";
    if (!docIban.file) return "Adjunta el documento de tu número de cuenta (IBAN)";
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
    // El documento de SS/IBAN debe ser del MISMO titular que el DNI aportado.
    if (docIban.deteccion === "ajeno")
      return "El documento del IBAN está a nombre de otra persona: debe coincidir con el DNI que has aportado.";
    if (docSs.deteccion === "ajeno")
      return "El documento de la Seguridad Social está a nombre de otra persona: debe coincidir con el DNI que has aportado.";
    // Números: distingue "falta escribirlo" de "está mal escrito".
    if (!dniNie.trim()) return "Escribe tu número de DNI/NIE en su casilla.";
    if (!esDniNieValido(dniNie)) return "El número de DNI/NIE no es válido: revísalo.";
    if (!iban.trim()) return "Escribe tu número de cuenta (IBAN) en su casilla.";
    if (!esIbanValido(iban)) return "El IBAN no es válido: revísalo.";
    if (!ss.trim()) return "Escribe tu número de la Seguridad Social en su casilla.";
    if (!esSeguridadSocialValida(ss)) return "El nº de la Seguridad Social no es válido: revísalo.";
    return null;
  }

  function enviar() {
    setError(null);
    const err = validar();
    if (err) { mostrarError(err); return; }

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("token", token);
        fd.set("dni_nie", normalizarDniNie(dniNie));
        fd.set("iban", normalizarIban(iban));
        fd.set("num_seguridad_social", normalizarSeguridadSocial(ss));
        // Adjunta cada archivo con un nombre seguro (iOS a veces entrega nombres
        // o tipos que rompen el envío). Reempaquetamos en un Blob con tipo limpio.
        const adj = (campo: string, d: DocState, ext: string) => {
          if (!d.file) return;
          const tipo = d.file.type || "application/octet-stream";
          fd.set(campo, d.file, `${campo}.${ext}`);
          void tipo;
        };
        adj("dni_anverso", dniAnverso, "jpg");
        adj("dni_reverso", dniReverso, "jpg");
        adj("doc_iban", docIban, "jpg");
        adj("doc_ss", docSs, "jpg");
        adj("foto_perfil", fotoPerfil, "jpg");
        fd.set("direccion", direccion.trim());
        // Fecha SIEMPRE en formato ISO (AAAA-MM-DD). En iOS el input date puede
        // devolver un valor no-ISO que rompe el envío; lo normalizamos aquí.
        fd.set("fecha_nacimiento", normalizarFechaISO(fechaNacimiento));

        const res = await fetch("/api/documentacion", { method: "POST", body: fd });
        // Intenta leer la respuesta como JSON; si no lo es (p.ej. 413 Payload Too
        // Large devuelve HTML), lo detectamos por el status.
        let data: { ok?: boolean; error?: string } = {};
        try { data = await res.json(); } catch { /* respuesta no-JSON */ }
        if (!res.ok || !data.ok) {
          // Mensaje según el problema real (no un genérico de "conexión").
          if (res.status === 413) {
            throw new Error("Alguna foto o documento pesa demasiado. Hazla con menos calidad o recórtala e inténtalo de nuevo.");
          }
          if (data.error) throw new Error(data.error); // mensaje claro del servidor
          throw new Error(`No se pudo enviar (error ${res.status}). Inténtalo otra vez.`);
        }
        setEnviado(true);
      } catch (e) {
        const raw = e instanceof Error ? e.message : "";
        // Los mensajes que ya son claros (del servidor o los nuestros de arriba)
        // se muestran tal cual. Solo el fallo de red puro cae en el genérico.
        const esRed = /failed to fetch|networkerror|load failed|network request failed/i.test(raw);
        const msg = esRed
          ? "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo otra vez."
          : (raw || "No se pudo enviar. Inténtalo de nuevo.");
        mostrarError(msg);
        toast.error(msg);
        // Registro para diagnóstico (visible en la consola del navegador).
        console.error("[documentacion] envío falló:", e);
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
            onFile={(f) => onDocFile(setDniReverso, "dni_reverso", f)}
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
            className="w-44"
          />
        </div>
      </section>

      <div className="rounded-md bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground">
        Leemos los números automáticamente para ahorrarte tiempo, pero tú decides: revísalos
        y corrige lo que haga falta antes de enviar.
      </div>

      {error && (
        <div
          ref={errorRef}
          className="rounded-md bg-destructive/10 text-destructive text-sm font-medium px-3 py-2.5 border border-destructive/30"
        >
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
