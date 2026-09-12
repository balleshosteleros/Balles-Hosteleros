"use client";

import { useMemo, useState, useTransition } from "react";
import { participarAction } from "@/features/marketing/actions/concurso-actions";
import type { EdicionPublica, ResultadoParticipacion } from "@/features/marketing/services/concurso";
import { CirculoOpcion } from "@/components/ui/circulo-opcion";

interface Props {
  empresaSlug: string;
  edicion: EdicionPublica;
}

/**
 * El juego del mes, tal y como lo ve el cliente.
 *
 * Una sola pantalla: las cinco preguntas, el correo y el botón. Nada de pasos ni
 * de cuenta atrás — quien llega aquí viene de un correo que le ha dicho que los
 * tres primeros ganan, y cualquier pantalla intermedia le cuesta el premio.
 *
 * La corrección la hace el servidor. Aquí no está la respuesta correcta.
 */
export function ConcursoForm({ empresaSlug, edicion }: Props) {
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoParticipacion | null>(null);
  const [enviando, startEnviar] = useTransition();

  const primario = edicion.color ?? "#0f172a";
  const marca = edicion.isotipoUrl ?? edicion.logoUrl;

  const faltan = useMemo(
    () => edicion.preguntas.filter((p) => respuestas[p.orden] === undefined).length,
    [edicion.preguntas, respuestas],
  );

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (faltan > 0) {
      setError(
        faltan === 1 ? "Te queda una pregunta por contestar" : `Te quedan ${faltan} preguntas por contestar`,
      );
      return;
    }
    startEnviar(async () => {
      const r = await participarAction({
        empresaSlug,
        clave: edicion.clave,
        email,
        nombre: nombre || undefined,
        respuestas: Object.fromEntries(Object.entries(respuestas)),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResultado(r);
    });
  }

  if (resultado?.ok) {
    return (
      <Resultado
        resultado={resultado}
        premio={edicion.premio}
        empresaNombre={edicion.empresaNombre}
        primario={primario}
        marca={marca}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        {marca ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={marca} alt={edicion.empresaNombre} className="h-16 w-auto object-contain" />
        ) : (
          <span className="text-xl font-semibold">{edicion.empresaNombre}</span>
        )}
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: primario }}
          >
            Concurso del mes
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-foreground">
            Cinco preguntas y {edicion.premio} en juego
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {edicion.plazasLibres > 0
              ? `Quedan ${edicion.plazasLibres} de ${edicion.plazas} premios. Se responden mirando nuestra carta.`
              : "Los premios ya están dados, pero puedes jugar igual y ver cuánto sabes."}
          </p>
        </div>
      </header>

      <form onSubmit={enviar} className="flex flex-col gap-7">
        {edicion.preguntas.map((p) => (
          <fieldset key={p.orden} className="flex flex-col gap-3">
            <legend className="text-base font-semibold text-foreground">
              <span className="mr-2 tabular-nums" style={{ color: primario }}>
                {p.orden}.
              </span>
              {p.enunciado}
            </legend>
            <div className="flex flex-col gap-2">
              {p.opciones.map((opcion, i) => {
                const marcada = respuestas[p.orden] === i;
                return (
                  <label
                    key={i}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors"
                    style={{
                      borderColor: marcada ? primario : undefined,
                      background: marcada ? `${primario}14` : undefined,
                    }}
                  >
                    <CirculoOpcion
                      checked={marcada}
                      onChange={() => setRespuestas((r) => ({ ...r, [p.orden]: i }))}
                      color={primario}
                    />
                    <span>{opcion}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-col gap-3 rounded-2xl border p-5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tu correo</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre@correo.com"
              className="h-11 rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-2"
              style={{ ["--tw-ring-color" as string]: primario }}
            />
            <span className="text-xs text-muted-foreground">
              Es el que usamos para avisarte si ganas. Solo se puede jugar una vez.
            </span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Tu nombre</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cómo te llamamos"
              className="h-11 rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-2"
              style={{ ["--tw-ring-color" as string]: primario }}
            />
          </label>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="h-12 rounded-xl text-base font-semibold text-white disabled:opacity-60"
          style={{ background: primario }}
        >
          {enviando ? "Comprobando…" : "Enviar respuestas"}
        </button>
      </form>
    </main>
  );
}

/** Lo que ve al terminar: ganó, acertó pero llegó tarde, o falló alguna. */
function Resultado({
  resultado,
  premio,
  empresaNombre,
  primario,
  marca,
}: {
  resultado: Extract<ResultadoParticipacion, { ok: true }>;
  premio: string;
  empresaNombre: string;
  primario: string;
  marca: string | null;
}) {
  const gana = resultado.posicion != null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center gap-6 px-5 py-12 text-center">
      {marca ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={marca} alt={empresaNombre} className="h-16 w-auto object-contain" />
      ) : null}

      {gana ? (
        <>
          <h1 className="text-3xl font-bold leading-tight">
            Has ganado {premio}
          </h1>
          <p className="text-sm text-muted-foreground">
            Has entrado en el puesto {resultado.posicion} de los tres. Enséñanos este código al
            llegar y la mesa corre de nuestra cuenta.
          </p>
          <div
            className="rounded-2xl border-2 px-8 py-6 font-mono text-4xl font-bold tracking-[0.3em]"
            style={{ borderColor: primario, color: primario }}
          >
            {resultado.codigo}
          </div>
          <p className="text-xs text-muted-foreground">
            Te lo mandamos también por correo, por si lo pierdes.
          </p>
        </>
      ) : resultado.pleno ? (
        <>
          <h1 className="text-3xl font-bold leading-tight">Las cinco, correctas</h1>
          <p className="text-sm text-muted-foreground">
            Te has quedado a las puertas: los tres premios ya estaban dados cuando has enviado.
            El mes que viene sale otro correo, y no decimos qué día.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold leading-tight">
            {resultado.aciertos} de {resultado.total}
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta vez no ha podido ser. El mes que viene hay otras cinco, y otro correo que no
            avisa del día.
          </p>
        </>
      )}
    </main>
  );
}
