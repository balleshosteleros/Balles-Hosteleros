"use client";

/**
 * Formulario público de valoración. Recibe el token y guarda la puntuación.
 *
 * DOS MODOS, según de dónde venga el token:
 *
 * - `desglosado` (correo posterior a una reserva): tres valoraciones —comida,
 *   servicio y ambiente— porque una nota global no dice QUÉ arreglar: un 3
 *   puede ser gran cocina con servicio lento, y son departamentos distintos.
 *   La de comida suele llegar ya puesta desde el correo (el cliente pulsó una
 *   estrella allí), así que aquí solo tiene que completar lo que quiera.
 *
 * - simple (QR de la carta): una sola valoración, como siempre. No hay visita
 *   concreta que desglosar.
 *
 * Servicio, ambiente y comentario son OPCIONALES a propósito: cuantos menos
 * campos obligatorios, más gente termina.
 *
 * Si la empresa tiene activado `redirigir_5estrellas_google` y la nota final
 * es 5 → tras enviar redirige a Google. Con menos, queda interna.
 */

import { useState } from "react";
import { Angry, Check, Frown, Laugh, Loader2, Meh, Smile, Star } from "lucide-react";

type Props = {
  token: string;
  nombreLead: string;
  nombreEmpresa: string;
  logoUrl: string | null;
  colorPrimario: string | null;
  ratingInicial: number | null;
  redirigir5EstrellasGoogle: boolean;
  googleReviewUrl: string | null;
  /** true = token de reserva: se piden las valoraciones por separado. */
  desglosado?: boolean;
  /**
   * Qué preguntas enseña la encuesta, según lo que cada empresa haya activado
   * en Reservas → Configuración → Comunicaciones. Solo aplica en modo
   * desglosado. Si se apagan todas, queda la nota general de siempre.
   */
  campos?: {
    cocina: boolean;
    bebida: boolean;
    servicio: boolean;
    ambiente: boolean;
    musica: boolean;
    espectaculo: boolean;
  };
  /**
   * true = con este enlace ya se valoró antes. Se enseña el agradecimiento en
   * vez del formulario: solo se admite una valoración por visita, y dejar el
   * formulario abierto haría creer que la segunda cuenta cuando se descarta.
   */
  yaRespondio?: boolean;
};

const LEYENDA = [
  "",
  "Lo sentimos",
  "No fue lo esperado",
  "Está bien",
  "Muy bueno",
  "¡Excelente!",
];

export function ResenaForm({
  token,
  nombreLead,
  nombreEmpresa,
  logoUrl,
  colorPrimario,
  ratingInicial,
  redirigir5EstrellasGoogle,
  googleReviewUrl,
  desglosado = false,
  campos = {
    cocina: true,
    bebida: false,
    servicio: true,
    ambiente: true,
    musica: false,
    espectaculo: false,
  },
  yaRespondio = false,
}: Props) {
  // Si la empresa apagó todas las preguntas, no hay nada que desglosar: se cae
  // a la estrella única, que se pregunta siempre.
  const desglose =
    desglosado &&
    (campos.cocina ||
      campos.bebida ||
      campos.servicio ||
      campos.ambiente ||
      campos.musica ||
      campos.espectaculo);
  // La nota que llega del correo es la valoración GENERAL de la experiencia.
  // La estrella que pulsó en el correo rellena SOLO la comida, que es lo que
  // se le preguntó allí. Servicio y ambiente empiezan vacíos.
  //
  // Antes se copiaba la misma nota a las tres: el cliente que pulsaba 4 llegaba
  // aquí con servicio y ambiente ya puntuados a 4 sin haber dicho nada, y no
  // había forma de distinguir lo que él había valorado de lo que le habíamos
  // rellenado nosotros. Enviaba tres notas creyendo haber dado una.
  const [comida, setComida] = useState<number>(ratingInicial ?? 0);
  const [bebida, setBebida] = useState<number>(0);
  const [musica, setMusica] = useState<number>(0);
  const [espectaculo, setEspectaculo] = useState<number>(0);
  /** Enlace a Google. Solo se rellena cuando la nota es de 5 estrellas. */
  const [urlResena, setUrlResena] = useState<string | null>(null);
  /** Nota media que se acabó enviando. Decide la cara de la pantalla final. */
  const [notaFinal, setNotaFinal] = useState<number | null>(null);
  const [servicio, setServicio] = useState<number>(0);
  const [ambiente, setAmbiente] = useState<number>(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  // Si ya se valoró con este enlace, se entra directamente en la pantalla de
  // agradecimiento (mismo destino que tras enviar).
  const [exito, setExito] = useState(yaRespondio);
  const [error, setError] = useState<string | null>(null);

  const color = colorPrimario || "#0ea5e9";

  /**
   * Nota global: media de lo que haya puntuado. Es la que decide Google.
   * Solo entran las preguntas que la empresa enseña: una nota apagada podría
   * conservar un valor de arranque y falsear la media.
   */
  const notas = (
    desglose
      ? [
          campos.cocina ? comida : 0,
          campos.bebida ? bebida : 0,
          campos.servicio ? servicio : 0,
          campos.ambiente ? ambiente : 0,
          campos.musica ? musica : 0,
          campos.espectaculo ? espectaculo : 0,
        ]
      : [comida]
  ).filter((n) => n > 0);
  const media =
    notas.length > 0
      ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length)
      : 0;

  const onSubmit = async () => {
    if (media < 1) {
      setError("Pulsa una estrella para valorar");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/visita/resena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          rating: media,
          comentario: comentario.trim(),
          ...(desglose
            ? {
                ratingComida: (campos.cocina && comida) || undefined,
                ratingBebida: (campos.bebida && bebida) || undefined,
                ratingMusica: (campos.musica && musica) || undefined,
                ratingEspectaculo:
                  (campos.espectaculo && espectaculo) || undefined,
                ratingServicio: (campos.servicio && servicio) || undefined,
                ratingAmbiente: (campos.ambiente && ambiente) || undefined,
              }
            : {}),
        }),
      });
      const body = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        redirect?: string;
      };
      if (!r.ok || !body.ok) {
        throw new Error(body.error || `Error ${r.status}`);
      }
      // Con 5 estrellas NO se salta a Google de golpe: se guarda el enlace y la
      // pantalla de gracias ofrece el botón.
      //
      // Antes se redirigía sin avisar, y eso tenía dos problemas: el cliente
      // aterrizaba en Google sin entender por qué, y ni siquiera llegaba a ver
      // que su valoración se había guardado. Quien llega a Google convencido
      // escribe; quien llega de rebote, cierra.
      if (
        media === 5 &&
        redirigir5EstrellasGoogle &&
        (body.redirect || googleReviewUrl)
      ) {
        setUrlResena(body.redirect || googleReviewUrl!);
      }
      setNotaFinal(media);
      setExito(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={nombreEmpresa}
            className="mx-auto mb-3 h-14 w-auto object-contain"
          />
        ) : (
          <div className="mb-3 text-xl font-bold" style={{ color }}>
            {nombreEmpresa}
          </div>
        )}
      </div>

      {exito ? (
        <div className="w-full rounded-2xl bg-white p-8 text-center shadow-lg">
          <div
            className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ background: color }}
          >
            <CaraSegunNota nota={notaFinal} />
          </div>

          {/* La nota, con la misma estrella del color de marca que acaba de
              pulsar en la pantalla anterior: reconoce lo que hizo. */}
          {urlResena && (
            <div className="mb-3 flex items-center justify-center gap-1.5">
              <span className="text-2xl font-bold" style={{ color }}>
                5
              </span>
              <Star className="h-6 w-6" style={{ color }} fill={color} />
            </div>
          )}
          <h2 className="text-xl font-semibold">
            {`¡Gracias${nombreLead ? `, ${nombreLead}` : ""}!`}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {urlResena
              ? `${nombreLead ? `${nombreLead}, n` : "N"}os has alegrado el día. Gracias de verdad.`
              : yaRespondio
                ? "Ya habías valorado esta visita, así que tu opinión está registrada. Esperamos verte pronto."
                : "Tu opinión es muy importante para nosotros. Esperamos verte pronto."}
          </p>

          {/* Invitación a reseñar en Google, solo tras 5 estrellas.
              El botón lleva la G de Google —inline, no una imagen remota, que
              en un móvil con mala cobertura tarda o no carga— porque reconocer
              la marca del destino es lo que hace que se pulse: el cliente sabe
              exactamente a dónde va.
              Texto corto a propósito: esta pantalla se lee de pasada, en el
              móvil y con prisa. Un párrafo largo aquí se salta entero. */}
          {urlResena && (
            <div className="mt-7 space-y-4 border-t border-gray-100 pt-6">
              <p className="text-base font-semibold text-gray-900">
                ¿Nos dejas tu reseña?
              </p>
              <p className="text-sm leading-relaxed text-gray-600">
                Es lo que hace que otros nos descubran.
              </p>
              <a
                href={urlResena}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-4 text-base font-bold text-gray-700 shadow-lg ring-1 ring-gray-200 transition-transform hover:scale-[1.02]"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
                  <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z" />
                  <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.9l7.3-5.7z" />
                  <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.3 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
                </svg>
                Reseñar en Google
              </a>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="text-center text-lg font-semibold text-gray-900">
            {nombreLead ? `Hola ${nombreLead}, ` : ""}¿qué tal lo pasaste?
          </h2>
          <p className="mt-1 text-center text-sm text-gray-600">
            {desglose
              ? "Pulsa las estrellas para puntuar."
              : "Tu opinión nos ayuda a mejorar."}
          </p>

          {desglose ? (
            <div className="mt-6 space-y-4">
              {campos.cocina && (
                <FilaEstrellas label="Comida" valor={comida} onChange={setComida} color={color} />
              )}
              {campos.bebida && (
                <FilaEstrellas label="Bebida" valor={bebida} onChange={setBebida} color={color} />
              )}
              {campos.servicio && (
                <FilaEstrellas label="Servicio" valor={servicio} onChange={setServicio} color={color} />
              )}
              {campos.ambiente && (
                <FilaEstrellas label="Ambiente" valor={ambiente} onChange={setAmbiente} color={color} />
              )}
              {campos.musica && (
                <FilaEstrellas label="Música" valor={musica} onChange={setMusica} color={color} />
              )}
              {campos.espectaculo && (
                <FilaEstrellas
                  label="Espectáculo"
                  valor={espectaculo}
                  onChange={setEspectaculo}
                  color={color}
                />
              )}
            </div>
          ) : (
            <>
              <Estrellas valor={comida} onChange={setComida} color={color} tamano="grande" />
              {comida > 0 && (
                <p className="mt-2 text-center text-xs font-medium" style={{ color }}>
                  {LEYENDA[comida]}
                </p>
              )}
            </>
          )}

          {/* El comentario escrito es lo que de verdad sirve para corregir: una
              nota dice que algo falló, el texto dice el qué. Va con etiqueta
              legible y caja alta —no en letra diminuta al final— porque antes
              pasaba desapercibido y casi nadie escribía. Sigue siendo
              opcional: obligarlo hunde el número de respuestas. */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-800">
              ¿Quieres contarnos algo más?{" "}
              <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              maxLength={1000}
              rows={4}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm leading-relaxed placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2"
              style={{ outlineColor: color }}
              placeholder="Cuéntanos lo bueno y lo que podemos mejorar"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            onClick={onSubmit}
            disabled={enviando}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ background: color }}
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            {enviando ? "Enviando…" : "Enviar valoración"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Una categoría con su nombre a la izquierda y sus estrellas a la derecha. */
function FilaEstrellas({
  label,
  valor,
  onChange,
  color,
}: {
  label: string;
  valor: number;
  onChange: (n: number) => void;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <Estrellas valor={valor} onChange={onChange} color={color} tamano="normal" />
    </div>
  );
}

function Estrellas({
  valor,
  onChange,
  color,
  tamano,
}: {
  valor: number;
  onChange: (n: number) => void;
  color: string;
  tamano: "normal" | "grande";
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cls = tamano === "grande" ? "h-10 w-10" : "h-7 w-7";
  return (
    <div
      className={
        tamano === "grande"
          ? "mt-6 flex items-center justify-center gap-1.5"
          : "flex items-center gap-0.5"
      }
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const activa = (hover ?? valor) >= n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded-full p-1 transition-transform hover:scale-110"
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
          >
            <Star
              className={`${cls} transition-colors`}
              style={{
                color: activa ? color : "#e5e7eb",
                fill: activa ? color : "transparent",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}


/**
 * La cara de la pantalla final, según lo que puntuó el cliente.
 *
 * No es adorno: devuelve lo que acaba de decir. A quien lo pasó mal, una cara
 * radiante le suena a que no le han escuchado; a quien lo pasó bien, un tick
 * neutro le sabe a poco. Sin nota (enlace ya usado) vuelve el tick de siempre.
 */
function CaraSegunNota({ nota }: { nota: number | null }) {
  if (nota === null) return <Check className="h-7 w-7" />;
  if (nota >= 5) return <Laugh className="h-8 w-8" />;
  if (nota >= 4) return <Smile className="h-8 w-8" />;
  if (nota >= 3) return <Meh className="h-8 w-8" />;
  if (nota >= 2) return <Frown className="h-8 w-8" />;
  return <Angry className="h-8 w-8" />;
}
