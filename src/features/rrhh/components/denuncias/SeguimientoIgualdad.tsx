"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Clock, Loader2, Scale } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getSeguimientoIgualdad, type FilaSeguimiento,
} from "@/features/mi-panel/actions/igualdad-actions";

/**
 * Quién ha confirmado la lectura del protocolo de igualdad y quién no.
 * Este listado es la prueba de que se ha comunicado a la plantilla.
 */
export function SeguimientoIgualdad() {
  const [confirmados, setConfirmados] = useState<FilaSeguimiento[]>([]);
  const [pendientes, setPendientes] = useState<FilaSeguimiento[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    const res = await getSeguimientoIgualdad();
    setConfirmados(res.data.confirmados);
    setPendientes(res.data.pendientes);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const total = confirmados.length + pendientes.length;
  const pct = total > 0 ? Math.round((confirmados.length / total) * 100) : 0;

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-start gap-4">
          <div className="h-11 w-11 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-medium">Comunicación del protocolo de igualdad</p>
            <p className="text-sm text-muted-foreground">
              La ley exige acreditar que el protocolo se ha comunicado a la plantilla.
              Este listado es esa prueba: <strong>{confirmados.length} de {total}</strong>{" "}
              personas ({pct} %) han confirmado la lectura.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <h3 className="font-semibold">Han confirmado ({confirmados.length})</h3>
            </div>
            {confirmados.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Todavía nadie.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Empleado</TableHead><TableHead>Fecha</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {confirmados.map((f) => (
                    <TableRow key={f.userId}>
                      <TableCell className="font-medium">{f.nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.confirmadoAt
                          ? format(parseISO(f.confirmadoAt), "d MMM yyyy", { locale: es })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h3 className="font-semibold">Pendientes ({pendientes.length})</h3>
            </div>
            {pendientes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Toda la plantilla lo ha confirmado.
              </p>
            ) : (
              <div className="space-y-1.5">
                {pendientes.map((f) => (
                  <div key={f.userId} className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">{f.nombre}</span>
                    <Badge variant="outline" className="text-xs">Sin confirmar</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
