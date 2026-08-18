"use client";

/**
 * Configuración de Sala → Música (engranaje de la barra de herramientas).
 *
 * Dos cosas y nada más: en qué horario puede sonar cada lista, y cuánto espacio
 * puede ocupar la música de la empresa. Todo lo que se configura aquí afecta a
 * lo que el equipo puede pulsar durante el servicio.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Clock, Plus, Trash2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMusica } from "@/features/sala/musica/contexts/musica-context";
import {
  anadirHorario,
  borrarHorario,
  actualizarLista,
  guardarCuotaMusica,
} from "@/features/sala/musica/actions/musica-actions";
import { DIAS_SEMANA, type ListaMusica } from "@/features/sala/musica/types";

export function ConfiguracionMusica() {
  const { listas, uso, recargar } = useMusica();

  const usadosGb = uso.bytesUsados / 1024 ** 3;
  const limiteGb = uso.bytesLimite / 1024 ** 3;
  const porcentaje = limiteGb > 0 ? Math.min(100, (usadosGb / limiteGb) * 100) : 0;

  const [nuevoLimite, setNuevoLimite] = useState(String(Math.round(limiteGb)));
  const [guardandoCuota, setGuardandoCuota] = useState(false);

  async function onGuardarCuota() {
    const g = Number(nuevoLimite);
    if (!Number.isFinite(g) || g < 1) {
      toast.error("Indica un número de GB válido");
      return;
    }
    setGuardandoCuota(true);
    const res = await guardarCuotaMusica(g);
    setGuardandoCuota(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar");
      return;
    }
    toast.success("Límite actualizado");
    await recargar();
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Configuración</h3>
          <p className="text-xs text-muted-foreground">
            Define en qué horario puede usarse cada lista. Fuera de su horario, la
            lista aparece bloqueada y no se puede reproducir.
          </p>
        </div>

        {/* Horarios por lista */}
        <div className="space-y-3">
          {listas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Crea una lista para poder darle horario.
            </p>
          ) : (
            listas.map((lista) => (
              <HorarioDeLista key={lista.id} lista={lista} onCambio={recargar} />
            ))
          )}
        </div>

        {/* Espacio de música */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold text-foreground">
              Espacio para música
            </h4>
          </div>

          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  porcentaje > 90 ? "bg-red-500" : "bg-emerald-600"
                }`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {usadosGb.toFixed(2).replace(".", ",")} GB usados de{" "}
              {limiteGb.toFixed(1).replace(".", ",")} GB
              {" · "}
              aproximadamente {Math.round(limiteGb * 17)} horas de música
            </p>
          </div>

          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="limite-musica" className="text-xs">
                Límite (GB)
              </Label>
              <Input
                id="limite-musica"
                type="number"
                min={1}
                max={100}
                value={nuevoLimite}
                onChange={(e) => setNuevoLimite(e.target.value)}
                className="h-9 w-28"
              />
            </div>
            <Button
              size="sm"
              className="h-9"
              onClick={() => void onGuardarCuota()}
              disabled={guardandoCuota}
            >
              {guardandoCuota ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Franjas horarias de una lista concreta. */
function HorarioDeLista({
  lista,
  onCambio,
}: {
  lista: ListaMusica;
  onCambio: () => Promise<void>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [inicio, setInicio] = useState("13:00");
  const [fin, setFin] = useState("17:00");
  const [guardando, setGuardando] = useState(false);

  async function onSinHorario(valor: boolean) {
    const res = await actualizarLista(lista.id, { sinHorario: valor });
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo cambiar");
      return;
    }
    await onCambio();
  }

  async function onAnadir() {
    if (dias.length === 0) {
      toast.error("Elige al menos un día");
      return;
    }
    setGuardando(true);
    const res = await anadirHorario({
      listaId: lista.id,
      dias,
      horaInicio: inicio,
      horaFin: fin,
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo guardar el horario");
      return;
    }
    toast.success("Horario añadido");
    setAbierto(false);
    await onCambio();
  }

  async function onBorrarFranja(id: string) {
    const res = await borrarHorario(id);
    if (!res.ok) {
      toast.error(res.error ?? "No se pudo eliminar");
      return;
    }
    await onCambio();
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {lista.nombre}
          </p>
          {lista.etiqueta && (
            <span className="text-xs text-muted-foreground">{lista.etiqueta}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Label
            htmlFor={`sin-horario-${lista.id}`}
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Siempre disponible
          </Label>
          <Switch
            id={`sin-horario-${lista.id}`}
            checked={lista.sinHorario}
            onCheckedChange={(v) => void onSinHorario(v)}
          />
        </div>
      </div>

      {!lista.sinHorario && (
        <div className="space-y-2">
          {lista.horarios.length === 0 ? (
            <p className="text-xs text-amber-600">
              Sin franjas: la lista está bloqueada a todas horas. Añade una o
              márcala como siempre disponible.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {lista.horarios.map((h) => (
                <Badge key={h.id} variant="secondary" className="gap-1.5 text-[11px]">
                  <Clock className="h-3 w-3" />
                  {h.dias.length === 7
                    ? "Todos los días"
                    : DIAS_SEMANA.filter((d) => h.dias.includes(d.valor))
                        .map((d) => d.corto)
                        .join(" ")}
                  {" · "}
                  {h.horaInicio}–{h.horaFin}
                  <button
                    type="button"
                    onClick={() => void onBorrarFranja(h.id)}
                    className="ml-0.5 text-muted-foreground hover:text-destructive"
                    aria-label="Eliminar franja"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {abierto ? (
            <div className="space-y-2 rounded-md bg-muted/40 p-2.5">
              <div className="flex flex-wrap gap-1">
                {DIAS_SEMANA.map((d) => {
                  const activo = dias.includes(d.valor);
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      onClick={() =>
                        setDias((prev) =>
                          activo
                            ? prev.filter((x) => x !== d.valor)
                            : [...prev, d.valor],
                        )
                      }
                      className={`h-7 w-7 rounded-md border text-xs font-medium transition-colors ${
                        activo
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      }`}
                      title={d.label}
                    >
                      {d.corto}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="time"
                    value={inicio}
                    onChange={(e) => setInicio(e.target.value)}
                    className="h-9 w-28"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input
                    type="time"
                    value={fin}
                    onChange={(e) => setFin(e.target.value)}
                    className="h-9 w-28"
                  />
                </div>
                <Button size="sm" className="h-9" onClick={() => void onAnadir()} disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9"
                  onClick={() => setAbierto(false)}
                >
                  Cancelar
                </Button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Si la hora de fin es anterior a la de inicio, la franja termina al
                día siguiente (por ejemplo, 23:00–03:00).
              </p>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setAbierto(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Añadir franja
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
