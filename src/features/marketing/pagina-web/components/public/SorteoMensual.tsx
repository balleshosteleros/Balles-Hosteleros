"use client";

/**
 * El sorteo del mes, justo debajo de la ubicación.
 *
 * Va ahí y no al final de todo porque el mapa es donde se detiene quien ya ha
 * decidido venir: ha visto la carta, ha mirado dónde estamos, y es el momento en
 * que se le puede pedir el correo. Después del mapa solo quedan los enlaces
 * legales, que nadie lee.
 *
 * Con foto y titular grande, no un pie de página discreto: compite con todo lo
 * de arriba —fotos de platos, vídeo del hero— y una línea de texto pequeño ahí
 * no la ve nadie. Lo que sigue siendo discreto es lo que se PIDE: hasta que
 * alguien pulsa el botón no hay ni un campo a la vista.
 *
 * Los cinco datos son los que hacen falta y ni uno más: nombre y apellidos para
 * escribirle por su nombre, la fecha de nacimiento porque el otro regalo de la
 * casa es el de cumpleaños, y el móvil y el correo para poder avisarle. Pedir
 * menos deja una ficha inservible; pedir más hace que la gente se vaya.
 */

import { useState } from "react";
import { Check, Gift, Loader2 } from "lucide-react";
import { suscribirSorteo } from "@/features/marketing/actions/sorteo-publico-actions";

export interface SorteoMensualProps {
  empresaSlug: string;
  /** "tres cenas para dos" · "tres catas de cócteles para dos". */
  premio: string;
  /** Color de la marca, para el botón y el visto. */
  color: string | null;
  /**
   * Foto de fondo. Sale de la propia web (galería, collage de la carta, historia
   * o el cartel del hero), así que es una foto de la casa y no hay nada que
   * configurar. Sin ella se pinta un degradado con el color de marca.
   */
  fotoUrl?: string | null;
}

type Estado = "cerrado" | "abierto" | "enviando" | "hecho";

const CAMPOS = [
  { id: "nombre", label: "Nombre", tipo: "text", auto: "given-name" },
  { id: "apellidos", label: "Apellidos", tipo: "text", auto: "family-name" },
  { id: "fechaNacimiento", label: "Fecha de nacimiento", tipo: "date", auto: "bday" },
  { id: "telefono", label: "Móvil", tipo: "tel", auto: "tel" },
  { id: "email", label: "Correo", tipo: "email", auto: "email" },
] as const;

export function SorteoMensual({
  empresaSlug,
  premio,
  color,
  fotoUrl,
}: SorteoMensualProps) {
  const [estado, setEstado] = useState<Estado>("cerrado");
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState({
    nombre: "",
    apellidos: "",
    fechaNacimiento: "",
    // El prefijo va puesto: sin él el teléfono no se guarda, y quien rellena un
    // formulario en el móvil no escribe "+34" por su cuenta.
    telefono: "+34 ",
    email: "",
  });

  const marca = color ?? "#d0a000";

  const enviar = async () => {
    setEstado("enviando");
    setError(null);
    const res = await suscribirSorteo({ empresaSlug, ...datos });
    if (!res.ok) {
      setError(res.error ?? "No hemos podido apuntarte.");
      setEstado("abierto");
      return;
    }
    setEstado("hecho");
  };

  const completo = CAMPOS.every((c) => datos[c.id].trim().length > 1);

  return (
    <section
      aria-label="Sorteo del mes"
      className="relative isolate overflow-hidden px-6 py-20 text-center sm:py-24"
    >
      {/* La foto va como fondo con un velo oscuro encima: sin el velo, el titular
          blanco se pierde en cuanto la foto tiene un plato claro. */}
      {fotoUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-20 h-full w-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-black/65"
            style={{
              backgroundImage: `linear-gradient(160deg, ${marca}40, rgba(0,0,0,0.78))`,
            }}
          />
        </>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `linear-gradient(160deg, ${marca}55, rgba(0,0,0,0.92))`,
          }}
        />
      )}

      {estado === "hecho" ? (
        <div className="mx-auto flex max-w-lg flex-col items-center gap-4 text-white">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white"
            style={{ color: marca }}
          >
            <Check className="h-8 w-8" strokeWidth={3} />
          </span>
          <p className="text-2xl font-semibold">Ya estás dentro</p>
          <p className="text-sm text-white/80">
            Te acabamos de mandar un correo con las bases. Cada mes recibirás uno
            nuestro, y dentro va el sorteo.
          </p>
        </div>
      ) : estado === "cerrado" ? (
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-white">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
            style={{ backgroundColor: marca, color: "#fff" }}
          >
            <Gift className="h-3.5 w-3.5" />
            Sorteo del mes
          </span>
          <h2 className="text-balance text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
            Ven gratis e invita a quien quieras
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-white/85">
            Cada mes sorteamos {premio}. Te llega un correo, contestas cinco
            preguntas de la casa, y si eres de los tres primeros en acertarlas, tu
            próxima visita corre de nuestra cuenta.
          </p>
          <button
            type="button"
            onClick={() => setEstado("abierto")}
            className="mt-1 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-black shadow-lg transition-transform hover:scale-[1.04]"
          >
            Quiero participar
          </button>
          <p className="text-xs text-white/60">
            Un correo al mes. Nada más.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-xl rounded-2xl bg-white/95 p-6 text-left shadow-2xl backdrop-blur sm:p-8">
          <p className="text-center text-2xl font-semibold text-slate-900">
            Entra en el sorteo
          </p>
          <p className="mb-6 mt-1 text-center text-sm text-slate-600">
            {premio} cada mes. Cinco datos y listo.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <div
                key={c.id}
                className={c.id === "email" ? "sm:col-span-2" : undefined}
              >
                <label
                  htmlFor={`sorteo-${c.id}`}
                  className="mb-1 block text-xs font-medium text-slate-600"
                >
                  {c.label}
                </label>
                <input
                  id={`sorteo-${c.id}`}
                  type={c.tipo}
                  autoComplete={c.auto}
                  value={datos[c.id]}
                  max={
                    c.tipo === "date"
                      ? new Date().toISOString().slice(0, 10)
                      : undefined
                  }
                  onChange={(e) => setDatos({ ...datos, [c.id]: e.target.value })}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={!completo || estado === "enviando"}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-base font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: marca }}
          >
            {estado === "enviando" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gift className="h-4 w-4" />
            )}
            Participar
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
            Un correo al mes. Puedes darte de baja cuando quieras desde el enlace
            que va en cada uno.
          </p>
        </div>
      )}
    </section>
  );
}
