"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Loader2, Scale, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BLOQUES_PROTOCOLO } from "@/features/mi-panel/data/protocolo-igualdad";
import { getMiConfirmacion, confirmarLectura } from "@/features/mi-panel/actions/igualdad-actions";

/**
 * Renderiza el markdown ligero del protocolo (##, ###, listas, **negrita**,
 * *cursiva*). No usamos una librería: el contenido es nuestro y controlado.
 */
function Markdown({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  const salida: React.ReactNode[] = [];
  let lista: string[] = [];

  const inline = (s: string, key: string) => {
    const partes = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
    return (
      <>
        {partes.map((p, i) => {
          if (p.startsWith("**") && p.endsWith("**")) {
            return <strong key={`${key}-${i}`} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
          }
          if (p.startsWith("*") && p.endsWith("*")) {
            return <em key={`${key}-${i}`}>{p.slice(1, -1)}</em>;
          }
          return <span key={`${key}-${i}`}>{p}</span>;
        })}
      </>
    );
  };

  const volcarLista = (key: string) => {
    if (lista.length === 0) return;
    salida.push(
      <ul key={`ul-${key}`} className="my-3 space-y-1.5 pl-5 list-disc marker:text-muted-foreground">
        {lista.map((li, i) => (
          <li key={i} className="text-sm leading-relaxed text-muted-foreground">
            {inline(li, `li-${key}-${i}`)}
          </li>
        ))}
      </ul>,
    );
    lista = [];
  };

  lineas.forEach((linea, i) => {
    const l = linea.trim();
    if (l.startsWith("- ")) { lista.push(l.slice(2)); return; }
    volcarLista(String(i));

    if (!l) return;
    if (l.startsWith("### ")) {
      salida.push(<h4 key={i} className="mt-5 mb-1.5 font-semibold text-foreground">{inline(l.slice(4), `h4-${i}`)}</h4>);
    } else if (l.startsWith("## ")) {
      salida.push(<h3 key={i} className="mt-6 mb-2 text-lg font-bold text-foreground">{inline(l.slice(3), `h3-${i}`)}</h3>);
    } else if (/^\d+\.\s/.test(l)) {
      salida.push(
        <p key={i} className="my-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          {inline(l, `ol-${i}`)}
        </p>,
      );
    } else {
      salida.push(
        <p key={i} className="my-2.5 text-sm leading-relaxed text-muted-foreground">
          {inline(l, `p-${i}`)}
        </p>,
      );
    }
  });
  volcarLista("fin");

  return <>{salida}</>;
}

export function IgualdadView() {
  const [confirmado, setConfirmado] = useState(false);
  const [fecha, setFecha] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await getMiConfirmacion();
    setConfirmado(res.confirmado);
    setFecha(res.fecha ?? null);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function confirmar() {
    setGuardando(true);
    const res = await confirmarLectura();
    setGuardando(false);
    if (!res.ok) { toast.error(res.error ?? "No se pudo confirmar"); return; }
    toast.success("Confirmado. Gracias por leerlo.");
    await cargar();
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5 pb-28">
      <Card>
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-11 w-11 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold">Igualdad y protocolo frente al acoso</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Este apartado está siempre disponible para toda la plantilla. Explica cómo
              nos comportamos entre compañeros, qué conductas no se toleran y qué hacer
              si sufres o presencias una situación de acoso. Puedes volver a consultarlo
              cuando quieras.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Índice */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Contenido
          </p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {BLOQUES_PROTOCOLO.map((b, i) => (
              <a
                key={b.id}
                href={`#${b.id}`}
                className="rounded-md p-2 text-sm transition-colors hover:bg-muted"
              >
                <span className="font-medium">{i + 1}. {b.titulo}</span>
                <span className="block text-xs text-muted-foreground">{b.resumen}</span>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {BLOQUES_PROTOCOLO.map((bloque, i) => (
        <Card key={bloque.id} id={bloque.id} className="scroll-mt-20">
          <CardContent className="p-5 md:p-6">
            <div className="flex items-center gap-2 border-b pb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <h2 className="font-bold">{bloque.titulo}</h2>
            </div>
            <div className="mt-1">
              <Markdown texto={bloque.contenido} />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Confirmación de lectura */}
      <Card className={confirmado ? "border-emerald-300 bg-emerald-50/50" : "border-primary/30"}>
        <CardContent className="p-5">
          {cargando ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : confirmado ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-900">Has confirmado la lectura</p>
                <p className="text-sm text-emerald-800">
                  {fecha
                    ? `El ${format(parseISO(fecha), "d 'de' MMMM 'de' yyyy", { locale: es })}.`
                    : ""}{" "}
                  Puedes volver a consultar este apartado siempre que lo necesites.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Confirma que lo has leído</p>
                  <p className="text-sm text-muted-foreground">
                    Al confirmar queda registrado tu nombre y la fecha. Es la constancia
                    de que la empresa te ha comunicado el protocolo — y de que tú conoces
                    el canal que tienes disponible si algún día lo necesitas.
                  </p>
                </div>
              </div>
              <Button variant="primary" onClick={confirmar} disabled={guardando}>
                {guardando ? "Guardando…" : "He leído el protocolo"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
