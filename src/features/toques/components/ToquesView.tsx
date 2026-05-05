"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import {
  calcularNivel,
  getCanjesPendientes,
  getHallOfFame,
  getMiBalance,
  getMisCanjes,
  getMiTimeline,
  getNiveles,
  getRanking,
  getReglas,
  getRecompensas,
  getReservadoEnCanjesPendientes,
} from "@/features/toques/services/toques.service";
import type {
  Balance,
  Canje,
  Ganador,
  Movimiento,
  Nivel,
  RankingRow,
  Recompensa,
  Regla,
  ToquePeriodo,
} from "@/features/toques/types/toques.types";
import { PERIODO_LABEL } from "@/features/toques/types/toques.types";
import { MiBalanceCard } from "./MiBalanceCard";
import { MisLogrosTimeline } from "./MisLogrosTimeline";
import { RankingTable } from "./RankingTable";
import { HallOfFame } from "./HallOfFame";
import { RecompensasGrid } from "./RecompensasGrid";
import { MisCanjesList } from "./MisCanjesList";
import { CanjeConfirmDialog } from "./CanjeConfirmDialog";
import { NivelesRoadmap } from "./NivelesRoadmap";
import { CatalogoToques } from "./CatalogoToques";
import { useToquesRealtime } from "@/features/toques/hooks/useToquesRealtime";

const PERIODOS: ToquePeriodo[] = ["dia", "semana", "mes", "trimestre", "ano", "historico"];

const EMPTY_BALANCE: Balance = {
  empresaId: "",
  userId: "",
  toquesAcumulados: 0,
  toquesCanjeables: 0,
  ultimoMovimientoAt: null,
};

export function ToquesView() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [balance, setBalance] = useState<Balance>(EMPTY_BALANCE);
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [timeline, setTimeline] = useState<Movimiento[]>([]);
  const [ganadores, setGanadores] = useState<Ganador[]>([]);
  const [misCanjes, setMisCanjes] = useState<Canje[]>([]);
  const [reservadoPendiente, setReservadoPendiente] = useState(0);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [fechaAlta, setFechaAlta] = useState<string | null>(null);

  const [periodo, setPeriodo] = useState<ToquePeriodo>("mes");
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [canjeTarget, setCanjeTarget] = useState<Recompensa | null>(null);

  const refrescarTodo = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No hay sesión activa.");
        setBootLoading(false);
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id, fecha_alta")
        .eq("user_id", user.id)
        .maybeSingle();
      const eId = (profile?.empresa_id as string) ?? null;
      setEmpresaId(eId);
      setFechaAlta((profile?.fecha_alta as string | null) ?? null);

      if (!eId) {
        setError("No estás asignado a una empresa.");
        setBootLoading(false);
        return;
      }

      const [
        balanceRes,
        nivelesRes,
        recompensasRes,
        timelineRes,
        ganadoresRes,
        misCanjesRes,
        reservadoRes,
        canjesPendRes,
        reglasRes,
      ] = await Promise.all([
        getMiBalance(supabase, user.id),
        getNiveles(supabase, eId),
        getRecompensas(supabase, eId),
        getMiTimeline(supabase, user.id, 30),
        getHallOfFame(supabase, eId, 8),
        getMisCanjes(supabase, user.id),
        getReservadoEnCanjesPendientes(supabase, user.id),
        getCanjesPendientes(supabase, eId).catch(() => [] as Canje[]),
        getReglas(supabase, eId),
      ]);
      setBalance(balanceRes);
      setNiveles(nivelesRes);
      setRecompensas(recompensasRes);
      setTimeline(timelineRes);
      setGanadores(ganadoresRes);
      setMisCanjes(misCanjesRes);
      setReservadoPendiente(reservadoRes);
      setReglas(reglasRes);
      void canjesPendRes; // disponible si en el futuro mostramos contador admin aquí
      setBootLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[toques:view:boot]", msg);
      setError(msg);
      setBootLoading(false);
    }
  }, [supabase]);

  const cargarRanking = useCallback(
    async (eId: string, p: ToquePeriodo, levels: Nivel[]) => {
      setRankingLoading(true);
      try {
        const rows = await getRanking(supabase, eId, p, levels);
        setRanking(rows);
      } catch (e) {
        console.error("[toques:view:ranking]", e);
        setRanking([]);
      } finally {
        setRankingLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    void refrescarTodo();
  }, [refrescarTodo]);

  useEffect(() => {
    if (!empresaId || niveles.length === 0) return;
    void cargarRanking(empresaId, periodo, niveles);
  }, [empresaId, niveles, periodo, cargarRanking]);

  useToquesRealtime(userId, () => {
    void refrescarTodo();
  });

  const nivelProgreso = useMemo(
    () => calcularNivel(balance.toquesAcumulados, niveles),
    [balance.toquesAcumulados, niveles]
  );
  const saldoDisponible = Math.max(0, balance.toquesCanjeables - reservadoPendiente);

  if (bootLoading) {
    return (
      <div className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card className="p-4 border-rose-200 bg-rose-50 text-rose-700 text-sm">{error}</Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      <MiBalanceCard
        balance={balance}
        nivelProgreso={nivelProgreso}
        reservadoPendiente={reservadoPendiente}
      />

      <NivelesRoadmap niveles={niveles} toquesAcumulados={balance.toquesAcumulados} />

      <CatalogoToques reglas={reglas} fechaAlta={fechaAlta} />

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-5">
          <Card className="p-4 md:p-5">
            <h2 className="text-base font-semibold mb-3">Ranking</h2>
            <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as ToquePeriodo)}>
              <TabsList className="mb-3 flex-wrap h-auto">
                {PERIODOS.map((p) => (
                  <TabsTrigger key={p} value={p} className="text-xs">
                    {PERIODO_LABEL[p]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <RankingTable
              rows={ranking}
              loading={rankingLoading}
              highlightUserId={userId ?? undefined}
            />
          </Card>

          <RecompensasGrid
            recompensas={recompensas}
            saldoDisponible={saldoDisponible}
            onCanjear={(r) => setCanjeTarget(r)}
          />

          <HallOfFame ganadores={ganadores} />
        </div>

        <div className="space-y-5">
          <MisLogrosTimeline items={timeline} />
          <MisCanjesList canjes={misCanjes} />
        </div>
      </div>

      {canjeTarget && (
        <CanjeConfirmDialog
          recompensa={canjeTarget}
          saldoDisponible={saldoDisponible}
          open={!!canjeTarget}
          onOpenChange={(o) => !o && setCanjeTarget(null)}
          onCanjeado={() => {
            setCanjeTarget(null);
            void refrescarTodo();
          }}
        />
      )}
    </div>
  );
}
