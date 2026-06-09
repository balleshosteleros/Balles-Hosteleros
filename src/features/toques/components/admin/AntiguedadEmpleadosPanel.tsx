"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Cake, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { actualizarFechaAlta } from "@/features/toques/actions/toques-admin-actions";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";

type Row = Record<string, unknown>;

interface Empleado {
  userId: string;
  nombre: string;
  email: string;
  departamento: string;
  fechaAlta: string;
}

function s(r: Row, k: string): string {
  return typeof r[k] === "string" ? (r[k] as string) : r[k] == null ? "" : String(r[k]);
}

function mesesDesde(fecha: string): number {
  if (!fecha) return 0;
  const a = new Date(`${fecha}T12:00:00Z`);
  const h = new Date();
  let meses = (h.getUTCFullYear() - a.getUTCFullYear()) * 12 + (h.getUTCMonth() - a.getUTCMonth());
  if (h.getUTCDate() < a.getUTCDate()) meses -= 1;
  return Math.max(0, meses);
}

function formatAntiguedad(meses: number): string {
  if (meses === 0) return "Menos de 1 mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anos = Math.floor(meses / 12);
  const restoMeses = meses % 12;
  if (restoMeses === 0) return `${anos} ${anos === 1 ? "año" : "años"}`;
  return `${anos}a ${restoMeses}m`;
}

export function AntiguedadEmpleadosPanel() {
  const supabase = useMemo(() => createClient(), []);
  const { empresaActual } = useEmpresa();
  const empresaActualDbId = empresaActual.dbId ?? null;
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sin sesión");
        setLoading(false);
        return;
      }
      const eId = empresaActualDbId;
      if (!eId) {
        setError("Sin empresa asignada");
        setLoading(false);
        return;
      }
      const { data, error: errD } = await supabase
        .from("usuarios")
        .select("user_id, full_name, nombre, email, departamento, fecha_alta, created_at")
        .eq("empresa_id", eId)
        .order("full_name", { ascending: true });
      if (errD) {
        setError(errD.message);
        setLoading(false);
        return;
      }
      const mapped = ((data ?? []) as Row[]).map((r) => ({
        userId: s(r, "user_id"),
        nombre: s(r, "full_name") || s(r, "nombre") || s(r, "email"),
        email: s(r, "email"),
        departamento: s(r, "departamento"),
        fechaAlta: s(r, "fecha_alta") || s(r, "created_at").slice(0, 10),
      }));
      setEmpleados(mapped);
      setDrafts(Object.fromEntries(mapped.map((e) => [e.userId, e.fechaAlta])));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [supabase, empresaActualDbId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const handleGuardar = async (userId: string) => {
    const fechaAlta = drafts[userId];
    if (!fechaAlta) return;
    setSaving(userId);
    const res = await actualizarFechaAlta({ userId, fechaAlta });
    setSaving(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void cargar();
  };

  const filtrados = empleados.filter((e) => {
    if (!filtro) return true;
    const q = filtro.toLowerCase();
    return (
      e.nombre.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.departamento.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 text-sm">{error}</Card>
      )}

      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Cake className="h-4 w-4 text-purple-500" />
              Fecha de alta por empleado
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              La fecha de alta determina cuántos points de antigüedad recibe cada persona. Si está vacía
              o es incorrecta, edítala aquí. El cron diario otorgará retroactivamente los aniversarios
              pendientes (idempotente).
            </p>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empleado…"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="h-8 pl-8 w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3">Empleado</th>
                <th className="py-2 pr-3">Departamento</th>
                <th className="py-2 pr-3 w-44">Fecha de alta</th>
                <th className="py-2 pr-3 w-32">Antigüedad</th>
                <th className="py-2 w-24">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((emp) => {
                const draft = drafts[emp.userId] ?? emp.fechaAlta;
                const dirty = draft !== emp.fechaAlta;
                const meses = mesesDesde(draft);
                return (
                  <tr key={emp.userId} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{emp.nombre || "—"}</div>
                      <div className="text-xs text-muted-foreground">{emp.email}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {emp.departamento ? (
                        <Badge variant="outline" className="text-[10px]">
                          {emp.departamento}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="date"
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [emp.userId]: e.target.value }))
                        }
                        max={new Date().toISOString().slice(0, 10)}
                        className="h-8"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary" className="text-xs">
                        {formatAntiguedad(meses)}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleGuardar(emp.userId)}
                        disabled={!dirty || saving === emp.userId}
                      >
                        {saving === emp.userId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Save className="h-3 w-3" />
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No hay empleados que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
