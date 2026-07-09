"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { type PuestoSalarial } from "@/features/rrhh/data/puestos";
import { listPuestosEmpresa } from "@/features/rrhh/actions/puestos-actions";
import { getBonusPorEmpresa, PERIODICIDAD_LABEL, type Bonus } from "@/features/rrhh/data/bonus";
import {
  Calendar,
  CalendarCheck,
  FileSignature,
  ClipboardCheck,
  ClipboardX,
  Gift,
  Wallet,
  Coins,
  PiggyBank,
  UserCog,
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
  fechaAlta: string;
  fechaBaja: string | null;
  tipoContrato: "Indefinido" | "Temporal";
}

function getBonusAplicables(
  bonus: Bonus[],
  puesto: PuestoSalarial | null,
  roles: string[],
): Bonus[] {
  const norm = (s: string) => s.toLowerCase().trim();
  const candidatos = new Set<string>();
  if (puesto) {
    candidatos.add(norm(puesto.puesto));
    candidatos.add(norm(puesto.departamento));
  }
  roles.forEach((r) => candidatos.add(norm(r)));

  return bonus
    .filter((b) => b.estado === "activo")
    .filter((b) => {
      const { tipo, ids } = b.destinatarios;
      if (tipo === "todos") return true;
      if (tipo === "empleados") return false;
      return ids.some((id) => {
        const n = norm(id);
        for (const c of candidatos) {
          if (!c) continue;
          if (c.includes(n) || n.includes(c)) return true;
        }
        return false;
      });
    });
}

function getDatosGenerales(puesto: PuestoSalarial | null): DatosGenerales {
  const total = puesto ? parseDiasVacaciones(puesto.vacaciones) : 30;
  return {
    vacacionesAno: total,
    vacacionesRestantes: Math.max(0, total - 8),
    fechaAlta: "Pendiente de configurar",
    fechaBaja: null,
    tipoContrato: "Indefinido",
  };
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

  const generales = useMemo(() => getDatosGenerales(puesto), [puesto]);
  const bonusAplicables = useMemo(
    () => getBonusAplicables(getBonusPorEmpresa(empresaActual.id), puesto, roles),
    [empresaActual.id, puesto, roles],
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <Card className="p-4 md:p-5 flex items-center gap-4 border-dashed">
        <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <UserCog className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Tus datos personales</p>
          <p className="text-xs text-muted-foreground">
            DNI, IBAN, dirección, contacto de emergencia y demás se gestionan en
            Datos personales.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/mi-panel/datos-personales">Ir a Datos personales</Link>
        </Button>
      </Card>

      <GeneralesCard datos={generales} />
      <SalarioCard puesto={puesto} />
      <HorarioCard puesto={puesto} />
      <BonusAplicablesCard bonus={bonusAplicables} />
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
      value: datos.fechaAlta,
      icon: ClipboardCheck,
      tone: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "Fecha de baja",
      value: datos.fechaBaja ?? "—",
      icon: ClipboardX,
      tone: "text-rose-600 bg-rose-500/10",
    },
    {
      label: "Tipo de contrato",
      value: datos.tipoContrato,
      icon: FileSignature,
      tone: "text-violet-600 bg-violet-500/10",
      badge: true,
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
                      it.value === "Indefinido"
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

function BonusAplicablesCard({ bonus }: { bonus: Bonus[] }) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bonus
        </h3>
        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0">
          {bonus.length} bonus
        </Badge>
      </div>

      {bonus.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No hay bonus activos que afecten a tu puesto.
        </p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {bonus.map((b) => (
            <li
              key={b.id}
              className="flex items-start gap-3 rounded-lg border p-3"
            >
              <div className="h-10 w-10 rounded-lg flex items-center justify-center text-amber-600 bg-amber-500/10 shrink-0">
                <Gift className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold truncate">{b.nombre}</p>
                  <Badge variant="secondary" className="bg-stone-100 text-stone-700 border-0 text-[10px]">
                    {PERIODICIDAD_LABEL[b.periodicidad]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {b.descripcion}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
