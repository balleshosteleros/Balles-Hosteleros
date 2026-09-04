"use client";

import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { type PuestoSalarial } from "@/features/rrhh/data/puestos";
import { listPuestosEmpresa } from "@/features/rrhh/actions/puestos-actions";
import { getMisCondicionesContrato, type MisCondicionesContrato } from "@/features/mi-panel/actions/mis-condiciones-actions";
import {
  Calendar,
  CalendarCheck,
  FileSignature,
  ClipboardCheck,
  ClipboardX,
  Wallet,
  Coins,
  PiggyBank,
} from "lucide-react";

const eur = (n: number) =>
  n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

function buscarPuestoUsuario(
  puestos: PuestoSalarial[],
  nombre: string,
  email: string,
  roles: string[],
): PuestoSalarial | null {
  if (!puestos.length) return null;
  const haystack = `${nombre} ${email} ${roles.join(" ")}`.toLowerCase();
  return (
    puestos.find((p) =>
      haystack.includes(p.puesto.toLowerCase()) ||
      haystack.includes(p.departamento.toLowerCase()),
    ) ?? null
  );
}

function parseDiasVacaciones(texto: string): number {
  const m = texto.match(/\d+/);
  return m ? parseInt(m[0], 10) : 30;
}

interface DatosGenerales {
  vacacionesAno: number;
  vacacionesRestantes: number;
  /** ISO o null: null se pinta como «—», nunca un valor inventado. */
  fechaAlta: string | null;
  fechaBaja: string | null;
  tipoJornada: string | null;
}

/** dd/mm/aaaa, o «—» si el dato aún no consta en su ficha. */
function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : "—";
}

export function MisCondicionesView() {
  const { profile, user, roles } = useAuth();
  const { empresaActual } = useEmpresa();
  const nombreCompleto = [profile?.nombre, profile?.apellidos].filter(Boolean).join(" ") || "—";
  const email = profile?.email || user?.email || "—";

  const [puestos, setPuestos] = useState<PuestoSalarial[]>([]);
  useEffect(() => {
    let activo = true;
    listPuestosEmpresa().then((res) => { if (activo) setPuestos(res.puestos); });
    return () => { activo = false; };
  }, [empresaActual.id]);

  const puesto = useMemo(
    () => buscarPuestoUsuario(puestos, nombreCompleto, email, roles),
    [puestos, nombreCompleto, email, roles],
  );

  const [contrato, setContrato] = useState<MisCondicionesContrato | null>(null);
  useEffect(() => {
    let activo = true;
    getMisCondicionesContrato().then((res) => {
      if (activo) setContrato(res.data);
    });
    return () => { activo = false; };
  }, [empresaActual.id]);

  // Mientras carga se muestran los días de la empresa por defecto, nunca un
  // saldo inventado: los valores reales llegan con la ficha del empleado.
  const generales: DatosGenerales = {
    vacacionesAno: contrato?.vacacionesAno ?? (puesto ? parseDiasVacaciones(puesto.vacaciones) : 30),
    vacacionesRestantes: contrato?.vacacionesRestantes ?? 0,
    fechaAlta: contrato?.fechaAlta ?? null,
    fechaBaja: contrato?.fechaBaja ?? null,
    tipoJornada: contrato?.tipoJornada ?? null,
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <GeneralesCard datos={generales} />
      <SalarioCard puesto={puesto} />
      <HorarioCard puesto={puesto} />
    </div>
  );
}

function GeneralesCard({ datos }: { datos: DatosGenerales }) {
  const items = [
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
      icon: FileSignature,
      tone: "text-violet-600 bg-violet-500/10",
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

function SalarioCard({ puesto }: { puesto: PuestoSalarial | null }) {
  const items = puesto
    ? [
        {
          label: "Salario bruto",
          value: `${eur(puesto.salarioBruto)} / mes`,
          icon: Wallet,
          tone: "text-emerald-600 bg-emerald-500/10",
        },
        {
          label: "Jornada",
          value: puesto.jornadaContrato || "—",
          icon: Coins,
          tone: "text-amber-600 bg-amber-500/10",
        },
        {
          label: "Horas / semana",
          value: `${puesto.horasSemanales}h`,
          icon: PiggyBank,
          tone: "text-sky-600 bg-sky-500/10",
        },
      ]
    : [
        { label: "Salario bruto", value: "Pendiente", icon: Wallet, tone: "text-emerald-600 bg-emerald-500/10" },
        { label: "Jornada", value: "Pendiente", icon: Coins, tone: "text-amber-600 bg-amber-500/10" },
        { label: "Horas / semana", value: "Pendiente", icon: PiggyBank, tone: "text-sky-600 bg-sky-500/10" },
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
      {!puesto && (
        <p className="text-[11px] text-muted-foreground mt-3 text-center">
          Las cifras se mostrarán cuando RRHH publique tu ficha laboral.
        </p>
      )}
    </Card>
  );
}

function HorarioCard({ puesto }: { puesto: PuestoSalarial | null }) {
  if (!puesto) {
    return (
      <Card className="p-4 md:p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Horario
        </h3>
        <p className="text-sm text-muted-foreground text-center py-6">
          Tu horario se mostrará cuando RRHH publique tu ficha laboral.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4 md:p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Horario
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {puesto.horarioSemanal.map((h) => {
          const libre = h.turno === "LIBRE";
          return (
            <div
              key={h.dia}
              className={`rounded-lg border p-3 flex flex-col items-center text-center ${
                libre ? "bg-muted/40" : "bg-card"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {h.dia}
              </p>
              <div className="mt-2 min-h-[2rem] flex items-center justify-center">
                {libre ? (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    LIBRE
                  </Badge>
                ) : (
                  <span className="text-sm font-semibold leading-tight">{h.turno}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Horas semanales</p>
          <p className="text-lg font-bold mt-0.5">{puesto.horasSemanales}h</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Días libres</p>
          <p className="text-lg font-bold mt-0.5">{puesto.diasLibres} / semana</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Jornada de contrato</p>
          <p className="text-lg font-bold mt-0.5">{puesto.jornadaContrato}</p>
        </div>
      </div>
    </Card>
  );
}
