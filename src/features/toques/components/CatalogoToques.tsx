"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  CalendarCheck,
  ShieldCheck,
  Cake,
  Trophy,
  Sparkles,
  Coins,
  Clock,
  Calendar,
  Award,
  Target,
  Zap,
  PartyPopper,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Regla, ReglaCategoria } from "@/features/toques/types/toques.types";
import { CATEGORIA_LABEL, CATEGORIA_DESCRIPCION } from "@/features/toques/types/toques.types";

interface Props {
  reglas: Regla[];
  fechaAlta: string | null;
}

const CATEGORIA_ICON: Record<ReglaCategoria, LucideIcon> = {
  dia_a_dia: Sun,
  constancia: CalendarCheck,
  excelencia: ShieldCheck,
  antiguedad: Cake,
  otros: Sparkles,
};

const CATEGORIA_GRADIENTE: Record<ReglaCategoria, string> = {
  dia_a_dia: "from-amber-50 to-orange-50 border-amber-200",
  constancia: "from-emerald-50 to-teal-50 border-emerald-200",
  excelencia: "from-blue-50 to-indigo-50 border-blue-200",
  antiguedad: "from-purple-50 to-pink-50 border-purple-200",
  otros: "from-slate-50 to-gray-50 border-slate-200",
};

const CATEGORIA_ACENTO: Record<ReglaCategoria, string> = {
  dia_a_dia: "text-amber-600 bg-amber-100",
  constancia: "text-emerald-600 bg-emerald-100",
  excelencia: "text-blue-600 bg-blue-100",
  antiguedad: "text-purple-600 bg-purple-100",
  otros: "text-slate-600 bg-slate-100",
};

const REGLA_ICON_BY_CODIGO: Record<string, LucideIcon> = {
  puntualidad_elite: Clock,
  cumplidor_dia: Target,
  cero_olvidos_fichaje: CalendarCheck,
  comunicado_leido_primero: Zap,
  velocidad_chat: Zap,
  asistencia_perfecta_semanal: Calendar,
  sin_vacaciones_trimestre: Award,
  appcc_al_dia: ShieldCheck,
  cero_mermas_cocina: ShieldCheck,
  caja_cuadrada: Coins,
  resolucion_incidencias: Target,
  aniversario_mensual: Calendar,
  aniversario_6_meses: Cake,
  aniversario_1_ano: Cake,
  aniversario_2_anos: Cake,
  aniversario_5_anos: PartyPopper,
  aniversario_10_anos: Trophy,
  cumpleanos_propio: Cake,
  san_valentin_balles: PartyPopper,
};

const PERIODICIDAD_LABEL: Record<string, string> = {
  diario: "Diario",
  semanal: "Semanal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  hito: "Hito único",
};

// Bonus por ranking (no son reglas configurables — vienen del cron de snapshots)
const BONUS_RANKING = [
  { nombre: "Ganador del día", descripcion: "El que más points sume en el día", toques: 5, icon: Trophy },
  { nombre: "Ganador de la semana", descripcion: "El que más points acumule en la semana", toques: 15, icon: Trophy },
  { nombre: "Empleado del Mes", descripcion: "Más points en el mes — figura en el Hall of Fame", toques: 50, icon: Trophy },
  { nombre: "Empleado del Trimestre", descripcion: "Más points en el trimestre", toques: 150, icon: Trophy },
  { nombre: "Empleado del Año", descripcion: "Más points en el año + super premio descriptivo", toques: 500, icon: Trophy },
];

const ORDEN_CATEGORIAS: ReglaCategoria[] = [
  "dia_a_dia",
  "constancia",
  "excelencia",
  "antiguedad",
  "otros",
];

function mesesDesde(fechaAlta: string | null): number | null {
  if (!fechaAlta) return null;
  const a = new Date(`${fechaAlta}T12:00:00Z`);
  const h = new Date();
  let meses = (h.getUTCFullYear() - a.getUTCFullYear()) * 12 + (h.getUTCMonth() - a.getUTCMonth());
  if (h.getUTCDate() < a.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

function HitoAntiguedadCard({ regla, mesesActuales }: { regla: Regla; mesesActuales: number | null }) {
  const Icon = REGLA_ICON_BY_CODIGO[regla.codigo] ?? Cake;
  // Solo aplica a reglas de hito que tienen mes objetivo en el código
  const hitoMeses: Record<string, number> = {
    aniversario_6_meses: 6,
    aniversario_1_ano: 12,
    aniversario_2_anos: 24,
    aniversario_5_anos: 60,
    aniversario_10_anos: 120,
  };
  const objetivo = hitoMeses[regla.codigo];
  const conseguido = objetivo != null && mesesActuales != null && mesesActuales >= objetivo;
  const restante = objetivo != null && mesesActuales != null ? Math.max(0, objetivo - mesesActuales) : null;

  return (
    <div
      className={`p-3 rounded-lg border bg-white flex items-start gap-3 ${
        conseguido ? "border-emerald-300 bg-emerald-50" : ""
      }`}
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          conseguido ? "bg-emerald-100 text-emerald-600" : "bg-purple-100 text-purple-600"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{regla.nombre}</span>
          {conseguido && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] hover:bg-emerald-100">
              Conseguido
            </Badge>
          )}
          {!regla.activa && (
            <Badge variant="outline" className="text-[10px] text-slate-500">
              Próximamente
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{regla.descripcion}</p>
        {restante != null && restante > 0 && (
          <p className="text-[11px] text-purple-600 font-medium mt-1">
            Te faltan {restante} {restante === 1 ? "mes" : "meses"}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-bold text-amber-600 tabular-nums leading-tight">
          +{regla.toques}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">points</div>
      </div>
    </div>
  );
}

function ReglaCard({ regla }: { regla: Regla }) {
  const Icon = REGLA_ICON_BY_CODIGO[regla.codigo] ?? Sparkles;
  const acento = CATEGORIA_ACENTO[regla.categoria] ?? CATEGORIA_ACENTO.otros;
  return (
    <div className="p-3 rounded-lg border bg-white flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${acento}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{regla.nombre}</span>
          <Badge variant="outline" className="text-[10px]">
            {PERIODICIDAD_LABEL[regla.periodicidad] ?? regla.periodicidad}
          </Badge>
          {!regla.activa && (
            <Badge variant="outline" className="text-[10px] text-slate-500">
              Próximamente
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{regla.descripcion}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="text-lg font-bold text-amber-600 tabular-nums leading-tight">
          +{regla.toques}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">points</div>
      </div>
    </div>
  );
}

export function CatalogoToques({ reglas, fechaAlta }: Props) {
  const [abierta, setAbierta] = useState<ReglaCategoria | "ranking">("dia_a_dia");
  const meses = mesesDesde(fechaAlta);

  // Agrupar reglas por categoría
  const porCategoria = new Map<ReglaCategoria, Regla[]>();
  for (const r of reglas) {
    const list = porCategoria.get(r.categoria) ?? [];
    list.push(r);
    porCategoria.set(r.categoria, list);
  }

  // Categorías con al menos una regla
  const categoriasConReglas = ORDEN_CATEGORIAS.filter((c) => (porCategoria.get(c)?.length ?? 0) > 0);

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Cómo ganar points
        </h2>
        {meses != null && (
          <Badge variant="outline" className="text-xs">
            <Cake className="h-3 w-3 mr-1 text-purple-500" />
            Llevas {meses} {meses === 1 ? "mes" : "meses"} en la empresa
          </Badge>
        )}
      </div>

      {/* Tabs de categorías */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {categoriasConReglas.map((cat) => {
          const Icon = CATEGORIA_ICON[cat];
          const activa = abierta === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setAbierta(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activa
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {CATEGORIA_LABEL[cat]}
              <span
                className={`ml-1 text-[10px] tabular-nums ${
                  activa ? "text-white/70" : "text-slate-500"
                }`}
              >
                {porCategoria.get(cat)?.length ?? 0}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setAbierta("ranking")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            abierta === "ranking"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          <Trophy className="h-3.5 w-3.5" />
          Ranking
          <span
            className={`ml-1 text-[10px] tabular-nums ${
              abierta === "ranking" ? "text-white/70" : "text-slate-500"
            }`}
          >
            {BONUS_RANKING.length}
          </span>
        </button>
      </div>

      {/* Contenido de la categoría seleccionada */}
      {abierta !== "ranking" && (
        <div className={`p-3 rounded-lg bg-gradient-to-br border ${CATEGORIA_GRADIENTE[abierta]}`}>
          <p className="text-xs text-slate-600 mb-3">{CATEGORIA_DESCRIPCION[abierta]}</p>
          <div className="space-y-2">
            {abierta === "antiguedad" ? (
              <>
                {(porCategoria.get("antiguedad") ?? [])
                  .sort((a, b) => a.toques - b.toques)
                  .map((r) =>
                    r.codigo === "aniversario_mensual" ? (
                      <ReglaCard key={r.id} regla={r} />
                    ) : (
                      <HitoAntiguedadCard key={r.id} regla={r} mesesActuales={meses} />
                    )
                  )}
              </>
            ) : (
              (porCategoria.get(abierta) ?? [])
                .sort((a, b) => b.toques - a.toques)
                .map((r) => <ReglaCard key={r.id} regla={r} />)
            )}
          </div>
        </div>
      )}

      {abierta === "ranking" && (
        <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200">
          <p className="text-xs text-slate-600 mb-3">
            Bonus automáticos al ganar el ranking de cada periodo. Se otorgan al cierre del periodo.
          </p>
          <div className="space-y-2">
            {BONUS_RANKING.map((b, i) => (
              <div key={i} className="p-3 rounded-lg border bg-white flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-100 text-amber-600">
                  <b.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{b.nombre}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.descripcion}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-amber-600 tabular-nums leading-tight">
                    +{b.toques}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    toques
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
