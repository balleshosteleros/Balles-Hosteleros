"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  getMisCondicionesContrato,
  getMiSalario,
  getMiHorarioSemana,
  type MisCondicionesContrato,
  type MisCondicionesSalario,
  type MisCondicionesHorario,
} from "@/features/mi-panel/actions/mis-condiciones-actions";
import {
  Calendar,
  CalendarCheck,
  FileSignature,
  ClipboardCheck,
  ClipboardX,
  Wallet,
  Clock,
  CalendarDays,
  Loader2,
} from "lucide-react";

/** Importe en euros con coma decimal: 1.600,00 €. */
const eur = (n: number) =>
  n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Número con coma decimal, sin ceros colgando: 37,5 h / 40 h. */
const horas = (n: number) =>
  `${n.toLocaleString("es-ES", { maximumFractionDigits: 2 })} h`;

interface DatosGenerales {
  vacacionesAno: number;
  vacacionesRestantes: number;
  /** ISO o null: null se pinta como «—», nunca un valor inventado. */
  fechaAlta: string | null;
  fechaBaja: string | null;
  tipoJornada: string | null;
  puesto: string | null;
}

/** dd/mm/aaaa, o «—» si el dato aún no consta en su ficha. */
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
}

export function MisCondicionesView() {
  const { empresaActual } = useEmpresa();

  const [contrato, setContrato] = useState<MisCondicionesContrato | null>(null);
  const [salario, setSalario] = useState<MisCondicionesSalario | null>(null);
  const [horario, setHorario] = useState<MisCondicionesHorario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.all([getMisCondicionesContrato(), getMiSalario(), getMiHorarioSemana()])
      .then(([c, s, h]) => {
        if (!activo) return;
        setContrato(c.data);
        setSalario(s.data);
        setHorario(h.data);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [empresaActual.id]);

  if (cargando) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Card className="p-10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      </div>
    );
  }

  const generales: DatosGenerales = {
    vacacionesAno: contrato?.vacacionesAno ?? 0,
    vacacionesRestantes: contrato?.vacacionesRestantes ?? 0,
    fechaAlta: contrato?.fechaAlta ?? null,
    fechaBaja: contrato?.fechaBaja ?? null,
    tipoJornada: contrato?.tipoJornada ?? null,
    puesto: contrato?.puesto ?? null,
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <GeneralesCard datos={generales} />
      <SalarioCard salario={salario} />
      <HorarioCard horario={horario} />
    </div>
  );
}

function GeneralesCard({ datos }: { datos: DatosGenerales }) {
  const items = [
    {
      label: "Puesto",
      value: datos.puesto ?? "—",
      icon: FileSignature,
      tone: "text-violet-600 bg-violet-500/10",
    },
    {
      label: "Vacaciones al año",
      value: `${datos.vacacionesAno} días`,
      icon: Calendar,
      tone: "text-blue-600 bg-blue-500/10",
    },
    {
      label: "Vacaciones restantes",
      value: `${datos.vacacionesRestantes} días`,
      icon: CalendarCheck,
      tone: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "Fecha de alta",
      value: fmtFecha(datos.fechaAlta),
      icon: ClipboardCheck,
      tone: "text-amber-600 bg-amber-500/10",
    },
    {
      // Solo se rellena al pasar a offboarding desde Reclutamiento. Hasta
      // entonces, un guion: el empleado sigue de alta.
      label: "Fecha de baja",
      value: fmtFecha(datos.fechaBaja),
      icon: ClipboardX,
      tone: "text-rose-600 bg-rose-500/10",
    },
    {
      label: "Jornada",
      value: datos.tipoJornada ?? "—",
      icon: Clock,
      tone: "text-sky-600 bg-sky-500/10",
      badge: !!datos.tipoJornada,
    },
  ];

  return (
    <Card className="p-4 md:p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Contrato
      </h3>
      <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${it.tone}`}>
              <it.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{it.label}</dt>
              <dd className="text-sm font-semibold mt-0.5 truncate">
                {it.badge ? (
                  <Badge
                    className={
                      it.value === "Completa"
                        ? "bg-emerald-100 text-emerald-700 border-0"
                        : "bg-amber-100 text-amber-700 border-0"
                    }
                  >
                    {it.value}
                  </Badge>
                ) : (
                  it.value
                )}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * Salario BRUTO mensual pactado en SU ficha. El puesto es solo la plantilla que
 * se copia al contratar: si luego le cambian las condiciones a mano, el puesto
 * ya no pinta nada. Sin cifra se dice que falta por publicar, nunca 0 €.
 */
function SalarioCard({ salario }: { salario: MisCondicionesSalario | null }) {
  const bruto = salario?.salarioBruto ?? null;
  const items = [
    {
      label: "Salario bruto",
      value: bruto !== null ? `${eur(bruto)} / mes` : "—",
      icon: Wallet,
      tone: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "Horas por semana",
      value: salario?.horasSemanales != null ? horas(salario.horasSemanales) : "—",
      icon: Clock,
      tone: "text-sky-600 bg-sky-500/10",
    },
    {
      label: "Días libres",
      value:
        salario?.diasLibres != null ? `${salario.diasLibres} / semana` : "—",
      icon: CalendarDays,
      tone: "text-amber-600 bg-amber-500/10",
    },
  ];

  return (
    <Card className="p-4 md:p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Salario
      </h3>
      <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${it.tone}`}>
              <it.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{it.label}</dt>
              <dd className="text-sm font-semibold mt-0.5 truncate">{it.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      {bruto === null && (
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          Tu salario aparecerá aquí cuando RRHH lo publique.
        </p>
      )}
    </Card>
  );
}

/**
 * Horario REAL de la semana en curso (turnos y patrones del empleado), no el
 * horario teórico del puesto: ese está vacío en toda la base.
 */
function HorarioCard({ horario }: { horario: MisCondicionesHorario | null }) {
  const dias = horario?.dias ?? [];

  return (
    <Card className="p-4 md:p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Horario de esta semana
      </h3>

      {dias.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Aún no tienes turnos asignados esta semana.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {dias.map((d) => (
            <div
              key={d.fecha}
              className={`rounded-lg border p-3 flex flex-col items-center text-center ${
                d.trabaja ? "bg-card" : "bg-muted/40"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d.letra}
              </p>
              <div className="mt-2 min-h-[2rem] flex flex-col items-center justify-center gap-0.5">
                {d.trabaja ? (
                  d.tramos.map((t) => (
                    <span key={t} className="text-sm font-semibold leading-tight">
                      {t}
                    </span>
                  ))
                ) : (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    Libre
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
