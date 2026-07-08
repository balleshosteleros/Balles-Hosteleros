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
type Campo = "dni_nie" | "iban" | "ss";

const TIPOS_IMG = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);
const MAX_BYTES = 10 * 1024 * 1024;

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
      // Del DNI también sacamos fecha de nacimiento y dirección (autocompletado).
      // Solo se rellenan si aún estaban vacíos; el candidato puede corregirlos.
      if (campo === "dni_nie") {
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
    if (!f) {
      // Quitar el documento: limpia el archivo y el número autodetectado de ese campo.
      setter(DOC_VACIO);
      if (campo === "dni_nie") setDniNie("");
      else if (campo === "iban") setIban("");
      else if (campo === "ss") setSs("");
      return;
    }
    if (f.size > MAX_BYTES) { setError("El archivo supera 10MB"); return; }
    const esImg = TIPOS_IMG.has(f.type);
    const esPdf = f.type === "application/pdf";
    if (!esImg && !esPdf) { setError("Formato no admitido (usa foto o PDF)"); return; }

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
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Error al enviar");
        setEnviado(true);
      } catch (e) {
        const raw = e instanceof Error ? e.message : "";
        // Nunca mostramos errores técnicos del navegador (en inglés) al candidato.
        // Si el mensaje no viene de nuestro servidor (español), lo traducimos.
        const esTecnico = !raw || /did not match|pattern|failed to fetch|network|unexpected|typeerror/i.test(raw);
        const msg = esTecnico
          ? "No hemos podido enviar tu documentación. Revisa que todos los campos y documentos estén completos e inténtalo de nuevo. Si sigue fallando, escríbenos."
          : raw;
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
          <p className="text-[11px] text-muted-foreground">
            Se rellena sola al leer tu DNI (suele estar en el reverso); revísala.
          </p>
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
          <p className="text-[11px] text-muted-foreground">
            Se rellena sola al leer tu DNI; revísala por si acaso.
          </p>
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
