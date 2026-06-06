"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CUPON_BENEFICIO_LABELS,
  describirBeneficio,
  type Cupon,
} from "@/features/sala/cupones/data/cupones";
import { listCuponesAction } from "@/features/sala/cupones/actions/cupones-actions";
import { CuponDrawer } from "./CuponDrawer";

function formatFecha(iso: string | null): string {
  if (!iso) return "Sin caducidad";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function chipDias(dias: string[]): string {
  if (dias.length === 7) return "Todos los días";
  return dias.map(d => d[0].toUpperCase() + d.slice(1, 3)).join(", ");
}

function chipTurnos(turnos: string[]): string {
  if (turnos.length === 2) return "Comida y cena";
  return turnos[0] === "COMIDA" ? "Solo comida" : "Solo cena";
}

export function CuponesView() {
  const [items, setItems] = useState<Cupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Cupon | null>(null);

  async function load() {
    setLoading(true);
    const res = await listCuponesAction();
    setItems(res.data);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(c =>
      c.codigo.toLowerCase().includes(q) ||
      c.tituloInterno.toLowerCase().includes(q) ||
      (c.tituloCliente ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  function openNuevo() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEditar(c: Cupon) {
    setEditing(c);
    setDrawerOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* BARRA HORIZONTAL 1: + Nuevo (izq) + buscar (der) */}
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-card">
        <Button size="sm" onClick={openNuevo}>
          <Plus className="h-4 w-4 mr-1" /> Nuevo
        </Button>
        <div className="relative w-72">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por código o título…"
            className="pl-8 h-8"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-sm text-muted-foreground p-8 text-center">Cargando cupones…</div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "Aún no hay cupones. Pulsa “+ Nuevo” para crear el primero."
                : "Ningún cupón coincide con la búsqueda."}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título interno</TableHead>
                    <TableHead>Beneficio</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Caducidad</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Turnos</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const agotado = c.stockConsumido >= c.stockTotal;
                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => openEditar(c)}
                        className="cursor-pointer hover:bg-muted/40"
                      >
                        <TableCell>
                          <Badge className="font-mono bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/40">
                            {c.codigo}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{c.tituloInterno}</TableCell>
                        <TableCell className="text-sm">
                          <div>{CUPON_BENEFICIO_LABELS[c.beneficioTipo]}</div>
                          <div className="text-xs text-muted-foreground">{describirBeneficio(c)}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className={agotado ? "text-destructive font-medium" : ""}>
                            {c.stockConsumido}/{c.stockTotal}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({c.unidadStock === "personas" ? "personas" : "reservas"})
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{formatFecha(c.fechaCaducidad)}</TableCell>
                        <TableCell className="text-xs">{chipDias(c.diasSemana)}</TableCell>
                        <TableCell className="text-xs">{chipTurnos(c.turnos)}</TableCell>
                        <TableCell>
                          {agotado ? (
                            <Badge variant="destructive">Agotado</Badge>
                          ) : c.activo ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0">Activo</Badge>
                          ) : (
                            <Badge variant="secondary">Pausado</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <CuponDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cupon={editing}
        onSaved={() => void load()}
      />
    </div>
  );
}
