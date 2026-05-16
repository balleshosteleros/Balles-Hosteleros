"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Landmark, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  listarBancosES,
  crearRequisition,
  conectarBancoExistente,
} from "@/features/contabilidad/actions/psd2-actions";

interface Institution {
  id: string;
  name: string;
  bic?: string;
  logo?: string;
  transactionTotalDays: number;
  countries: string[];
}

export function ConectarBancoDialog({
  open,
  onOpenChange,
  prefilter,
  reconnectConnectionId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefilter?: string;
  reconnectConnectionId?: string;
}) {
  const [bancos, setBancos] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBusqueda(prefilter ?? "");
    setLoading(true);
    listarBancosES()
      .then((res) => {
        if (res.ok) setBancos(res.data);
        else toast.error(`No se pudo cargar la lista de bancos: ${res.error}`);
      })
      .finally(() => setLoading(false));
  }, [open, prefilter]);

  const filtrados = useMemo(() => {
    if (!busqueda) return bancos;
    const q = busqueda.toLowerCase();
    return bancos.filter((b) => b.name.toLowerCase().includes(q));
  }, [bancos, busqueda]);

  async function conectar(banco: Institution) {
    setEnviando(banco.id);
    const res = reconnectConnectionId
      ? await conectarBancoExistente(reconnectConnectionId, {
          institutionId: banco.id,
          institutionName: banco.name,
          institutionLogo: banco.logo,
        })
      : await crearRequisition({
          institutionId: banco.id,
          institutionName: banco.name,
          institutionLogo: banco.logo,
        });
    if (res.ok) {
      window.location.href = res.redirectUrl;
    } else {
      toast.error(`No se pudo iniciar la conexión: ${res.error}`);
      setEnviando(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conectar banco</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar tu banco..."
              className="pl-9"
              autoFocus
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && filtrados.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {busqueda ? "Sin bancos coincidentes." : "Sin bancos disponibles."}
              </p>
            )}
            {!loading &&
              filtrados.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={enviando !== null}
                  onClick={() => conectar(b)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {b.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.logo}
                      alt={b.name}
                      className="h-8 w-8 rounded object-contain bg-white border"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.name}</p>
                    {b.bic && (
                      <p className="text-xs text-muted-foreground truncate">
                        {b.bic}
                      </p>
                    )}
                  </div>
                  {enviando === b.id && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
