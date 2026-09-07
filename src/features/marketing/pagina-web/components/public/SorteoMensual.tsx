"use client";

/**
 * El apartado del sorteo, al final de la página del restaurante.
 *
 * Discreto a propósito: una línea y un botón. Quien viene a ver la carta o a
 * reservar no debe tropezarse con un formulario de cinco campos —eso espanta—,
 * así que los campos no existen hasta que alguien pulsa. Al pulsar, se despliega
 * la tarjeta, se rellena en veinte segundos y sale el visto verde.
 *
 * Los cinco datos son los que hacen falta y ni uno más: nombre y apellidos para
 * escribirle por su nombre, la fecha de nacimiento porque el otro regalo de la
 * casa es el de cumpleaños, y el móvil y el correo para poder avisarle. Pedir
 * menos deja una ficha inservible; pedir más hace que la gente se vaya.
 */

import { useState } from "react";
import { Check, Gift, Loader2 } from "lucide-react";
import { suscribirSorteo } from "@/features/marketing/actions/sorteo-publico-actions";

/** Lo que se sortea, ya en palabras, tal y como lo verá el visitante. */
export interface SorteoMensualProps {
  empresaSlug: string;
  /** "tres cenas para dos" · "tres catas de cócteles para dos". */
  premio: string;
  /** Color de la marca, para el botón y el visto. */
  color: string | null;
}

type Estado = "cerrado" | "abierto" | "enviando" | "hecho";

const CAMPOS = [
  { id: "nombre", label: "Nombre", tipo: "text", auto: "given-name" },
  { id: "apellidos", label: "Apellidos", tipo: "text", auto: "family-name" },
  { id: "fechaNacimiento", label: "Fecha de nacimiento", tipo: "date", auto: "bday" },
  { id: "telefono", label: "Móvil", tipo: "tel", auto: "tel" },
  { id: "email", label: "Correo", tipo: "email", auto: "email" },
] as const;

export function SorteoMensual({ empresaSlug, premio, color }: SorteoMensualProps) {
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

  const marca = color ?? "#0f172a";

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
      className="border-t border-white/10 px-6 py-10 text-center"
    >
      {estado === "hecho" ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: `${marca}1a`, color: marca }}
          >
            <Check className="h-6 w-6" strokeWidth={3} />
          </span>
          <p className="text-base font-medium">Ya estás dentro</p>
          <p className="text-sm opacity-70">
            Te acabamos de mandar un correo con las bases. Cada mes recibirás uno
            nuestro: dentro va el sorteo.
          </p>
        </div>
      ) : estado === "cerrado" ? (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
          <p className="text-sm opacity-70">
            Cada mes sorteamos {premio} entre nuestros clientes.
          </p>
          <button
            type="button"
            onClick={() => setEstado("abierto")}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: marca, color: "#fff" }}
          >
            <Gift className="h-4 w-4" />
            Quiero participar
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-xl text-left">
          <p className="mb-1 text-center text-base font-medium">
            Entra en el sorteo
          </p>
          <p className="mb-5 text-center text-sm opacity-70">
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
                  className="mb-1 block text-xs opacity-70"
                >
                  {c.label}
                </label>
                <input
                  id={`sorteo-${c.id}`}
                  type={c.tipo}
                  autoComplete={c.auto}
                  value={datos[c.id]}
                  max={c.tipo === "date" ? new Date().toISOString().slice(0, 10) : undefined}
                  onChange={(e) =>
                    setDatos({ ...datos, [c.id]: e.target.value })
                  }
                  className="h-11 w-full rounded-lg border border-white/20 bg-white/5 px-3 text-sm outline-none focus:border-white/40"
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-sm text-rose-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={!completo || estado === "enviando"}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{ backgroundColor: marca, color: "#fff" }}
          >
            {estado === "enviando" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gift className="h-4 w-4" />
            )}
            Participar
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed opacity-50">
            Un correo al mes. Puedes darte de baja cuando quieras desde el enlace
            que va en cada uno.
          </p>
        </div>
      )}
    </section>
  );
}
