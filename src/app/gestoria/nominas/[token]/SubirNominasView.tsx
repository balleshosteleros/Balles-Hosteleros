"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Loader2, ShieldQuestion } from "lucide-react";
import { MAX_NOMINAS_MB, MAX_NOMINAS_BYTES } from "@/shared/lib/documentos";
import { mesAnterior } from "@/features/rrhh/lib/nominas-periodos";
import { friendlyError } from "@/shared/lib/friendly-errors";

interface Props {
  /** Endpoint POST al que se suben las nóminas. */
  endpoint: string;
  empresaNombre: string;
  /** Meses elegibles y su estado. El enlace es permanente: el mes lo elige aquí. */
  meses: EstadoMes[];
  /** Mes preseleccionado: el anterior al actual, que es el habitual. */
  mesSugerido: string;
}

export interface EstadoMes {
  periodo: string;
  /** Confirmado por RRHH: no admite subidas. */
  cerrado: boolean;
  /** Ya tiene nóminas pero sigue abierto: caben más archivos del mismo mes. */
  tieneNominas: boolean;
  /** Devuelto por RRHH para corregir: vuelve a estar libre. */
  rechazado: boolean;
}

interface MesIncorrecto {
  etiqueta: string;
  periodoLeido: string;
}

/** Cuadre de los recibos de UN mes cotizado contra las nóminas de ESE mes. */
interface CuadreMesCotizado {
  periodo: string;
  totalNominas: number;
  totalTc1: number | null;
  diferencia: number | null;
  cuadra: boolean;
  numNominas: number;
  numTc1: number;
  tc1SinImporte: number;
  /** No hay nóminas de ese mes todavía: no hay contra qué comparar. */
  sinNominas: boolean;
}

interface Cuadre {
  /** Cuántos TC1 hay adjuntos (ordinaria + complementarias). */
  numTc1?: number;
  /** Recibos guardados sin líquido legible: el total está incompleto. */
  tc1SinImporte?: number;
  totalNominas: number;
  totalTc1: number | null;
  diferencia: number | null;
  cuadra: boolean;
  numNominas: number;
  trabajadoresTc1: number | null;
  /** Desglose por el mes que cotiza cada recibo. */
  porMesCotizado?: CuadreMesCotizado[];
  /** Meses cotizados cuyos recibos esperan a que lleguen sus nóminas. */
  mesesSinNominas?: string[];
}

interface Resultado {
  guardadas: number;
  yaExistian: number;
  sinEmpleado: string[];
  /** Volcadas correctamente, pero de trabajadores que ya constaban de baja. */
  inactivos: { nombre: string; fechaBaja: string | null }[];
  mesIncorrecto: MesIncorrecto[];
  rechazadoTodo: boolean;
  /** Comparación TC1 ↔ nóminas. null si aún no hay TC1. */
  cuadre: Cuadre | null;
}

/** "2416.7" → "2.416,70 €" */
function eur(n: number): string {
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-07-31" → "31/07/2026". Fecha pura (sin hora): se parte el texto, no se
 *  construye un Date, para que no la desplace ninguna zona horaria. */
function fechaCorta(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function nombreMesCorto(periodo: string): string {
  const [y, m] = (periodo ?? "").split("-");
  const mes = MESES_ES[Number(m) - 1];
  return mes ? `${mes} ${y}` : periodo;
}

const TIPOS_OK = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
];

/** Los 12 meses hasta `hasta` (incluido), del más reciente al más antiguo. */
function mesesHasta(hasta: string, n = 12): string[] {
  const out: string[] = [];
  let p = hasta;
  for (let i = 0; i < n; i++) {
    out.push(p);
    p = mesAnterior(p);
  }
  return out;
}

export function SubirNominasView({ endpoint, empresaNombre, meses, mesSugerido }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tc1Ref = useRef<HTMLInputElement>(null);
  const [subiendoTc1, setSubiendoTc1] = useState(false);
  // Nombres de los TC1 ya subidos. Es una LISTA porque un mes puede llevar varias
  // liquidaciones (la ordinaria y la complementaria de vacaciones), que la
  // Seguridad Social emite y cobra por separado.
  const [tc1Subidos, setTc1Subidos] = useState<{ nombre: string; mes: string }[]>([]);
  // Mes que se está COTIZANDO en el recibo. Por defecto el anterior al de las
  // nóminas: la Seguridad Social se liquida a mes vencido, así que con las
  // nóminas de agosto llega el TC1 de julio. Es lo normal, no un error.
  // Mes de las NÓMINAS que se suben. Antes lo imponía el enlace; ahora se elige.
  const [mesNominas, setMesNominas] = useState(mesSugerido);
  const mesActualElegido = meses.find((m) => m.periodo === mesNominas);
  const mesCerrado = mesActualElegido?.cerrado ?? false;
  const [mesTc1, setMesTc1] = useState(() => mesAnterior(mesSugerido));
  const mesesTc1 = mesesHasta(mesSugerido);
  // Cuadre devuelto al subir un TC1: se enseña AL MOMENTO, sin esperar a las
  // nóminas, para que la gestoría sepa ya si el recibo cuadra o falta alguno.
  const [cuadreTc1, setCuadreTc1] = useState<Cuadre | null>(null);

  // El TC1 se sube por separado: es un documento de la EMPRESA (bases y cuotas de
  // toda la plantilla), no una nómina.
  const subirTc1 = async (f: File | null) => {
    if (!f) return;
    setError(null);
    if (f.size > MAX_NOMINAS_BYTES) {
      setError(`El TC1 supera ${MAX_NOMINAS_MB} MB.`);
      return;
    }
    setSubiendoTc1(true);
    try {
      const fd = new FormData();
      fd.append("archivo", f);
      fd.append("documento", "tc1");
      fd.append("periodo", mesNominas);
      // A qué mes corresponden estos seguros sociales (lo dice la gestoría).
      fd.append("periodoCotizacion", mesTc1);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        setTc1Subidos((prev) => [...prev, { nombre: f.name, mes: json.periodoCotizacion ?? mesTc1 }]);
        setCuadreTc1((json.cuadre as Cuadre | null) ?? null);
      } else setError(json.error ?? "No se pudo subir el TC1.");
    } catch (err) {
      setError(friendlyError(err, "subirTc1"));
    } finally {
      setSubiendoTc1(false);
    }
  };

  const onSelect = (f: File | null) => {
    setError(null);
    setResultado(null);
    if (!f) return setFile(null);
    const tipoOk = TIPOS_OK.includes(f.type) || /\.pdf$/i.test(f.name);
    if (!tipoOk) {
      setError("Formato no admitido. Usa un PDF (recomendado) o una imagen.");
      return;
    }
    // Tope de la LECTURA por IA (no el de documentos): más allá, el modelo no
    // procesa el archivo de forma fiable. Se avisa aquí para no hacerle esperar
    // una subida que el servidor va a rechazar igualmente.
    if (f.size > MAX_NOMINAS_BYTES) {
      setError(
        `El archivo supera ${MAX_NOMINAS_MB} MB. Comprímelo o avisa a la empresa: las nóminas del mes deben ir en un solo envío.`,
      );
      return;
    }
    setFile(f);
  };

  const subir = async () => {
    if (!file) return;
    setEnviando(true);
    setError(null);
    setResultado(null);
    try {
      const fd = new FormData();
      fd.append("archivo", file);
      fd.append("documento", "nominas");
      fd.append("periodo", mesNominas);
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) {
        setResultado({
          guardadas: json.guardadas ?? 0,
          yaExistian: json.yaExistian ?? 0,
          sinEmpleado: json.sinEmpleado ?? [],
          inactivos: json.inactivos ?? [],
          mesIncorrecto: json.mesIncorrecto ?? [],
          cuadre: json.cuadre ?? null,
          rechazadoTodo: json.rechazadoTodo ?? false,
        });
        // Las nóminas cambian el lado del contraste: el recuadro del TC1 tiene
        // que reflejar el cuadre nuevo, no el de antes de subirlas.
        setCuadreTc1((json.cuadre as Cuadre | null) ?? null);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(json.error ?? "No se pudieron subir las nóminas.");
      }
    } catch (err) {
      setError(friendlyError(err, "subir"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
        <h1 className="text-lg font-semibold text-zinc-900">Subir nóminas</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {empresaNombre} · elige el mes y adjunta los documentos.
        </p>

        {/* El enlace ya no lleva el mes dentro: se elige aquí. Es lo primero que
            se ve porque manda sobre todo lo que se suba debajo. */}
        <div className="mt-4">
          <label htmlFor="mes-nominas" className="block text-xs font-medium text-zinc-700">
            Mes de las nóminas
          </label>
          <select
            id="mes-nominas"
            value={mesNominas}
            onChange={(e) => setMesNominas(e.target.value)}
            disabled={enviando}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
          >
            {meses.map((m) => (
              <option key={m.periodo} value={m.periodo}>
                {nombreMesCorto(m.periodo)}
                {m.cerrado
                  ? " · ya entregado"
                  : m.rechazado
                    ? " · devuelto para corregir"
                    : m.tieneNominas
                      ? " · entrega empezada"
                      : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-600">
            Este enlace es <b>permanente</b>: sirve para cualquier mes y no caduca.
            Guárdalo.
          </p>
        </div>

        {mesCerrado ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            Las nóminas de <b>{nombreMesCorto(mesNominas)}</b> ya están validadas por la
            empresa: no se pueden volver a subir. Si hay que corregir algo, pide al
            departamento de RRHH que devuelva el mes.
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
            Se guardarán como nóminas de <b>{nombreMesCorto(mesNominas)}</b>. Adjunta
            <b> todas las del mes en la misma subida</b>: si el archivo contiene alguna de
            otro mes, no se guardará ninguna. En cuanto las subas pasan a{" "}
            <b>recursos humanos para su validación</b>.
          </div>
        )}

        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <p className="font-semibold">Hacen falta dos documentos</p>
          <ol className="mt-1.5 list-decimal list-inside space-y-1">
            <li>
              <b>Las nóminas</b> del mes: un único PDF con todas (una por página) o varios
              archivos sueltos. Se leen y se asignan a cada trabajador automáticamente.
            </li>
            <li>
              <b>El TC1</b> (Recibo de Liquidación de Cotizaciones) de la empresa, indicando de qué
              mes son esos seguros sociales: normalmente el <b>anterior</b> al de las nóminas, porque
              se liquidan a mes vencido. Si hay liquidación complementaria (vacaciones), adjunta
              también ese recibo.
            </li>
          </ol>
        </div>

        {/* ── TC1: documento de EMPRESA, va aparte de las nóminas ── */}
        <div className="mt-4 rounded-xl border border-zinc-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">TC1 · Recibos de cotizaciones</p>
              <p className="mt-0.5 text-xs text-zinc-600">
                {tc1Subidos.length > 0
                  ? `${tc1Subidos.length} recibo${tc1Subidos.length === 1 ? "" : "s"} recibido${tc1Subidos.length === 1 ? "" : "s"}. Si hay complementaria, adjúntala también.`
                  : "Los documentos de la empresa con las bases y cuotas del mes."}
              </p>
            </div>
            <input
              ref={tc1Ref}
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
              className="hidden"
              onChange={(e) => {
                void subirTc1(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => tc1Ref.current?.click()}
              disabled={subiendoTc1}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              {subiendoTc1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {subiendoTc1 ? "Subiendo…" : tc1Subidos.length > 0 ? "Adjuntar otro" : "Adjuntar TC1"}
            </button>
          </div>

          {/* MES COTIZADO: se pregunta, no se supone. Los seguros sociales van a
              mes vencido, así que con las nóminas de agosto llega el TC1 de julio;
              se propone ese y la gestoría lo cambia si el recibo es de otro. */}
          <div className="mt-3">
            <label htmlFor="mes-tc1" className="block text-xs font-medium text-zinc-700">
              Mes de estos seguros sociales
            </label>
            <select
              id="mes-tc1"
              value={mesTc1}
              onChange={(e) => setMesTc1(e.target.value)}
              disabled={subiendoTc1}
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 disabled:opacity-50"
            >
              {mesesTc1.map((m) => (
                <option key={m} value={m}>
                  {nombreMesCorto(m)}
                  {m === mesAnterior(mesNominas) ? " · lo habitual" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-600">
              Elígelo <b>antes</b> de adjuntar el recibo. Si el mes lleva liquidación
              complementaria de otro periodo, adjúntala aparte con su propio mes.
            </p>
          </div>

          {tc1Subidos.length > 0 && (
            <ul className="mt-3 space-y-1">
              {tc1Subidos.map((t, i) => (
                <li key={`${t.nombre}-${i}`} className="flex items-center gap-1.5 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t.nombre}</span>
                  <span className="shrink-0 text-emerald-600">· {nombreMesCorto(t.mes)}</span>
                </li>
              ))}
            </ul>
          )}

          {/* AVISO INMEDIATO: nada más subir el recibo se compara su líquido (leído
              por IA) con la cotización de las nóminas ya recibidas. Así la gestoría
              sabe al momento si cuadra, en vez de enterarse al final. */}
          {cuadreTc1 && (cuadreTc1.mesesSinNominas?.length ?? 0) === 0 &&
            cuadreTc1.numNominas > 0 && cuadreTc1.totalTc1 != null &&
            (cuadreTc1.tc1SinImporte ?? 0) === 0 && (
            <div
              className={`mt-3 rounded-lg border p-3 text-xs ${
                cuadreTc1.cuadra
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-rose-300 bg-rose-50 text-rose-900"
              }`}
            >
              <p className="flex items-center gap-1.5 font-semibold">
                {cuadreTc1.cuadra ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                {cuadreTc1.cuadra ? "Coincide con las nóminas" : "NO coincide con las nóminas"}
              </p>
              <ul className="mt-2 space-y-1">
                <li className="flex justify-between gap-4">
                  <span>
                    Líquido de totales
                    {(cuadreTc1.numTc1 ?? 1) > 1 ? ` (${cuadreTc1.numTc1} recibos)` : ""}
                  </span>
                  <b className="tabular-nums">{eur(cuadreTc1.totalTc1)}</b>
                </li>
                <li className="flex justify-between gap-4">
                  <span>Cotizaciones de las {cuadreTc1.numNominas} nóminas</span>
                  <b className="tabular-nums">{eur(cuadreTc1.totalNominas)}</b>
                </li>
                {!cuadreTc1.cuadra && (
                  <li className="flex justify-between gap-4 border-t border-rose-300 pt-1">
                    <span>Diferencia</span>
                    <b className="tabular-nums">{eur(Math.abs(cuadreTc1.diferencia ?? 0))}</b>
                  </li>
                )}
              </ul>
              {!cuadreTc1.cuadra && (
                <p className="mt-2">
                  Revisad si falta alguna liquidación complementaria (vacaciones) por adjuntar o
                  alguna nómina por subir. Los importes deben coincidir <b>exactamente</b>.
                </p>
              )}
            </div>
          )}

          {/* El TC1 llega antes que las nóminas: no hay contra qué compararlo
              todavía. Se dice, para que no se lea como un "todo correcto". */}
          {cuadreTc1 && ((cuadreTc1.mesesSinNominas?.length ?? 0) > 0 || cuadreTc1.numNominas === 0) && (
            <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
              Recibido. Estos seguros sociales son de{" "}
              <b>
                {(cuadreTc1.mesesSinNominas ?? []).map(nombreMesCorto).join(" y ") ||
                  nombreMesCorto(mesTc1)}
              </b>
              , y de ese mes todavía no constan las nóminas: la comprobación se hará cuando estén.
            </p>
          )}

          {/* Guardado pero sin líquido legible: no se puede afirmar que cuadre. */}
          {cuadreTc1 && (cuadreTc1.mesesSinNominas?.length ?? 0) === 0 &&
            cuadreTc1.numNominas > 0 &&
            (cuadreTc1.totalTc1 == null || (cuadreTc1.tc1SinImporte ?? 0) > 0) && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Recibido, pero no hemos podido leer el <b>líquido de totales</b>
              {(cuadreTc1.tc1SinImporte ?? 0) > 1 ? " de algunos recibos" : " del documento"}, así
              que no se ha podido comprobar si coincide con las nóminas. Revisadlo con RRHH.
            </p>
          )}
        </div>

        <p className="mt-4 text-sm font-semibold text-zinc-900">Nóminas del mes</p>

        {/* Archivo RECHAZADO por completo: tiene errores, no se ha subido nada. */}
        {resultado && resultado.rechazadoTodo && (
          <div className="mt-5 rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                <p className="font-semibold">No se ha podido subir · NO se ha guardado nada</p>
                <p className="mt-1">
                  Para evitar cargar datos incorrectos, <b>no se ha volcado ninguna nómina</b>.
                  Revisa los puntos que se indican abajo y vuelve a subir el archivo <b>completo</b>.
                  Si no puedes resolverlo, <b>contacta con el departamento de RRHH de la empresa</b>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Éxito: solo si NO hubo rechazo Y los importes cuadran. Con descuadre,
            la entrega no es válida: sale el aviso rojo de abajo, no este. */}
        {resultado && !resultado.rechazadoTodo && (resultado.cuadre?.cuadra ?? true) && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-900">
                <p className="font-semibold">Nóminas recibidas</p>
                <p className="mt-1">
                  {resultado.guardadas} nómina{resultado.guardadas === 1 ? "" : "s"} volcada
                  {resultado.guardadas === 1 ? "" : "s"} al sistema
                  {resultado.yaExistian > 0
                    ? ` · ${resultado.yaExistian} ya estaba${resultado.yaExistian === 1 ? "" : "n"}`
                    : ""}
                  .
                </p>
                <p className="mt-2 text-xs text-emerald-700">
                  Puedes seguir subiendo más archivos si te faltan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Trabajadores ya dados de baja: SÍ se han volcado. Solo comprobación. */}
        {resultado && !resultado.rechazadoTodo && resultado.inactivos.length > 0 && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
            <div className="flex items-start gap-2">
              <ShieldQuestion className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-sm text-sky-900">
                <p className="font-semibold">
                  Comprueba {resultado.inactivos.length === 1 ? "esta nómina" : `estas ${resultado.inactivos.length} nóminas`}
                </p>
                <p className="mt-1">
                  Se {resultado.inactivos.length === 1 ? "ha volcado" : "han volcado"} <b>correctamente</b>, no hay que
                  hacer nada más. Solo te avisamos por precaución:{" "}
                  {resultado.inactivos.length === 1 ? "este trabajador figura ya" : "estos trabajadores figuran ya"} de baja
                  en el sistema.
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {resultado.inactivos.map((x, i) => (
                    <li key={i}>
                      {x.nombre}
                      {x.fechaBaja ? (
                        <> — fin de contrato el <b>{fechaCorta(x.fechaBaja)}</b></>
                      ) : (
                        <> — sin fecha de fin de contrato registrada</>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-sky-700">
                  Es lo habitual cuando la baja es a final de mes y la nómina se envía el día 1: el trabajador
                  cobra el periodo que sí trabajó. Si es el caso, todo correcto. Si no lo esperabas, avisa a la empresa.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* DESCUADRE TC1 ↔ nóminas: el TC1 y las nóminas son el mismo dinero
            expresado de dos formas, así que la suma de cotizaciones de las
            nóminas debe coincidir con el líquido del TC1. */}
        {resultado?.cuadre && !resultado.cuadre.cuadra &&
          (resultado.cuadre.mesesSinNominas?.length ?? 0) === 0 &&
          resultado.cuadre.totalTc1 != null && (
          <div className="mt-4 rounded-xl border-2 border-rose-300 bg-rose-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                <p className="font-semibold">Los importes NO cuadran · entrega no válida</p>
                <p className="mt-1">
                  El total de los TC1 no coincide con la suma de las cotizaciones de las nóminas
                  del mes que cotizan
                  {(resultado.cuadre.porMesCotizado ?? []).length > 0
                    ? ` (${(resultado.cuadre.porMesCotizado ?? [])
                        .map((c) => nombreMesCorto(c.periodo))
                        .join(" y ")})`
                    : ""}
                  :
                </p>
                <ul className="mt-2 space-y-1">
                  <li className="flex justify-between gap-4">
                    <span>Cotizaciones sumadas de las nóminas</span>
                    <b className="tabular-nums">{eur(resultado.cuadre.totalNominas)}</b>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span>
                      Líquido de totales
                      {(resultado.cuadre.numTc1 ?? 1) > 1
                        ? ` (${resultado.cuadre.numTc1} recibos)`
                        : " del TC1"}
                    </span>
                    <b className="tabular-nums">{eur(resultado.cuadre.totalTc1)}</b>
                  </li>
                  <li className="flex justify-between gap-4 border-t border-rose-300 pt-1">
                    <span>Diferencia</span>
                    <b className="tabular-nums">{eur(Math.abs(resultado.cuadre.diferencia ?? 0))}</b>
                  </li>
                </ul>
                {resultado.cuadre.trabajadoresTc1 != null && (
                  <p className="mt-2">
                    Los TC1 declaran <b>{resultado.cuadre.trabajadoresTc1} trabajadores</b> y hemos
                    recibido <b>{resultado.cuadre.numNominas} nóminas</b>.
                  </p>
                )}
                <p className="mt-2 text-sm text-rose-900">
                  <b>Los importes deben coincidir EXACTAMENTE</b>, sin ni un céntimo de
                  diferencia. El enlace sigue abierto: corregid el documento que falle y volved
                  a subirlo.
                </p>
                <p className="mt-2 text-xs text-rose-800">
                  Comprobad si falta alguna nómina, si queda por adjuntar alguna liquidación
                  complementaria (vacaciones) o si hay algún concepto de los TC1 que no aparece
                  desglosado en las nóminas. Si el descuadre tuviera una explicación correcta,
                  poneos en contacto con el departamento de RRHH de la empresa antes de continuar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Detalle: nóminas de otro mes (motivo de rechazo). */}
        {resultado && resultado.mesIncorrecto.length > 0 && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                <p className="font-semibold">
                  {resultado.mesIncorrecto.length} nómina
                  {resultado.mesIncorrecto.length === 1 ? "" : "s"} de otro mes
                </p>
                <p className="mt-1">
                  Solo se admiten nóminas de <b>{nombreMesCorto(mesNominas)}</b>. Estas pertenecen a otro mes.
                  Quítalas o corrige el mes:
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {resultado.mesIncorrecto.map((x, i) => (
                    <li key={i}>
                      {x.etiqueta} — leída como <b>{nombreMesCorto(x.periodoLeido)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Empleados no dados de alta: no hay a quién asignarlas. */}
        {resultado && resultado.sinEmpleado.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold">
                  No se puede subir: {resultado.sinEmpleado.length} nómina
                  {resultado.sinEmpleado.length === 1 ? "" : "s"} sin trabajador
                </p>
                <p className="mt-1">
                  Est{resultado.sinEmpleado.length === 1 ? "e trabajador no figura" : "os trabajadores no figuran"} en
                  la base de datos de la empresa (ni en activo ni como baja anterior), así que no hay a quién
                  asignar {resultado.sinEmpleado.length === 1 ? "su nómina" : "sus nóminas"}:
                </p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {resultado.sinEmpleado.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-amber-900">
                  <b>No se permitirá subir este archivo</b> mientras haya alguna nómina sin trabajador
                  asignado: no se vuelca <b>ninguna</b>, para no cargar el mes a medias.
                </p>
                <p className="mt-2 text-sm text-amber-900">
                  <b>Ponte en contacto con el departamento de RRHH de la empresa</b> para que lo revisen:
                  o dan de alta al trabajador, o te confirman que esa nómina no debe enviarse.
                </p>
                <p className="mt-2 text-xs text-amber-800">
                  Si crees que es un error de lectura (nombre o DNI mal reconocidos), corrígelo y vuelve a
                  subir el archivo completo.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Zona de subida */}
        <div
          className="mt-5 border-2 border-dashed border-zinc-300 rounded-xl p-6 text-center cursor-pointer hover:border-zinc-400 transition"
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-zinc-800">
              <FileText className="h-5 w-5 text-emerald-600" />
              <span className="text-sm font-medium">{file.name}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <UploadCloud className="h-8 w-8" />
              <span className="text-sm">Pulsa para elegir el archivo de nóminas</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 text-sm text-rose-600">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={subir}
          disabled={!file || enviando || mesCerrado}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-lg py-2.5 font-medium disabled:opacity-50 hover:bg-emerald-700 transition"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {enviando ? "Leyendo y volcando…" : "Subir nóminas"}
        </button>

        {enviando && (
          <p className="mt-2 text-center text-xs text-zinc-500">
            Un PDF con muchas nóminas puede tardar un poco. No cierres la ventana.
          </p>
        )}
      </div>
    </div>
  );
}
