"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { KeyRound, Loader2, MessageSquareWarning, VenetianMask } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listMisDenuncias, consultarPorCodigo,
  type DenunciaRow, type EstadoDenuncia, type SeguimientoAnonimo,
} from "@/features/mi-panel/actions/denuncias-actions";
import { CATEGORIA_LABEL } from "./DenunciaModal";

const ESTADO_LABEL: Record<EstadoDenuncia, string> = {
  recibida: "Recibida",
  en_investigacion: "En investigación",
  informacion_solicitada: "Información solicitada",
  resuelta: "Resuelta",
  archivada: "Archivada",
};

const ESTADO_COLOR: Record<EstadoDenuncia, string> = {
  recibida: "bg-blue-100 text-blue-800 border-blue-300",
  en_investigacion: "bg-amber-100 text-amber-800 border-amber-300",
  informacion_solicitada: "bg-purple-100 text-purple-800 border-purple-300",
  resuelta: "bg-emerald-100 text-emerald-800 border-emerald-300",
  archivada: "bg-slate-100 text-slate-600 border-slate-300",
};

/**
 * Las quejas que el empleado presentó A SU NOMBRE. Las anónimas no aparecen
 * aquí por definición: se consultan con el código de seguimiento.
 */
export function MisDenunciasCard({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<DenunciaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [codigoOpen, setCodigoOpen] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listMisDenuncias();
    setItems(res.ok ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar, refreshKey]);

  return (
    <Card className="p-4 md:p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <MessageSquareWarning className="h-4 w-4" />
        </div>
        <h2 className="font-semibold">Mis quejas y denuncias</h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => setCodigoOpen(true)}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Consultar anónima
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No has presentado ninguna queja a tu nombre.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((d) => (
            <div key={d.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.asunto}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORIA_LABEL[d.categoria]} ·{" "}
                    {format(parseISO(d.created_at), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
                <Badge className={`shrink-0 text-xs ${ESTADO_COLOR[d.estado]}`}>
                  {ESTADO_LABEL[d.estado]}
                </Badge>
              </div>
              {d.respuesta && (
                <p className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">Respuesta de RRHH:</strong> {d.respuesta}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <ConsultaAnonimaDialog open={codigoOpen} onOpenChange={setCodigoOpen} />
    </Card>
  );
}

function ConsultaAnonimaDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<SeguimientoAnonimo | null>(null);

  async function buscar() {
    if (!codigo.trim()) return;
    setBuscando(true);
    const res = await consultarPorCodigo(codigo);
    setBuscando(false);
    if (!res.ok || !res.data) {
      toast.error(res.error ?? "No se encontró");
      setResultado(null);
      return;
    }
    setResultado(res.data);
  }

  function cerrar() {
    onOpenChange(false);
    setTimeout(() => { setCodigo(""); setResultado(null); }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <VenetianMask className="h-5 w-5 text-amber-600" />
            Consultar comunicación anónima
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Introduce el código que recibiste al presentarla. Sigue sin revelarse quién
          eres.
        </p>

        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="sr-only">Código</Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="XXXX-XXXX-XXXX"
              className="font-mono uppercase"
              onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
            />
          </div>
          <Button variant="primary" onClick={buscar} disabled={!codigo.trim() || buscando}>
            {buscando ? "Buscando…" : "Buscar"}
          </Button>
        </div>

        {resultado && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{resultado.asunto}</p>
                <p className="text-xs text-muted-foreground">
                  Presentada el{" "}
                  {format(parseISO(resultado.created_at), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
              <Badge className={`shrink-0 text-xs ${ESTADO_COLOR[resultado.estado]}`}>
                {ESTADO_LABEL[resultado.estado]}
              </Badge>
            </div>
            {resultado.respuesta ? (
              <p className="rounded-md bg-muted/50 p-2 text-xs">
                <strong>Respuesta de RRHH:</strong> {resultado.respuesta}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Todavía no hay respuesta de Recursos Humanos.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
