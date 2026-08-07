"use client";

/**
 * Ajustes → Departamentos → MARKETING → Página web.
 *
 * La dirección web pertenece a la EMPRESA, no a una página suelta: una empresa
 * tiene un dominio y de él cuelgan todas sus páginas. Por eso aquí se listan
 * todas las direcciones de la empresa activa y se elige a qué página apunta
 * cada una, en lugar de dar por hecho la página desde la que se entró.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Globe, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  eliminarDominio,
  listarDominiosEmpresa,
  verificarDominio,
} from "../../../actions/dominios-actions";
import { listarPaginas } from "../../../actions/paginas-actions";
import { WizardDominioDialog } from "./WizardDominioDialog";
import { EstadoDominio } from "./EstadoDominio";
import type { PaginaWeb, PaginaWebDominio } from "../../../types";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

export function DireccionWebEmpresaPanel() {
  const [dominios, setDominios] = useState<PaginaWebDominio[]>([]);
  const [paginas, setPaginas] = useState<PaginaWeb[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginaDestino, setPaginaDestino] = useState<string>("");
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState<PaginaWebDominio | null>(null);
  const [verificando, setVerificando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const [resDom, resPag] = await Promise.all([listarDominiosEmpresa(), listarPaginas()]);
    if (resDom.ok) setDominios(resDom.data);
    else toast.error(resDom.error);
    if (resPag.ok) {
      setPaginas(resPag.data);
      setPaginaDestino((prev) => prev || resPag.data[0]?.id || "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mientras haya direcciones sin verificar, reintentar cada 15s.
  useEffect(() => {
    if (!dominios.some((d) => d.estado !== "VERIFICADO")) return;
    const t = setInterval(() => {
      Promise.all(
        dominios.filter((d) => d.estado !== "VERIFICADO").map((d) => verificarDominio(d.id)),
      ).then(() => cargar());
    }, 15_000);
    return () => clearInterval(t);
  }, [dominios, cargar]);

  const nombrePagina = useMemo(() => {
    const map = new Map(paginas.map((p) => [p.id, p.nombre]));
    return (id: string) => map.get(id) ?? "—";
  }, [paginas]);

  const verificarManual = async (id: string) => {
    setVerificando(id);
    const res = await verificarDominio(id);
    if (res.ok) {
      if (res.data.estado === "VERIFICADO") toast.success("Dirección verificada");
      else toast.message("Aún pendiente. Revisa los datos en tu proveedor del dominio.");
      cargar();
    } else {
      toast.error(res.error);
    }
    setVerificando(null);
  };

  const eliminar = async () => {
    if (!confirmEliminar) return;
    const res = await eliminarDominio(confirmEliminar.id);
    if (res.ok) {
      toast.success("Dirección web desconectada");
      cargar();
    } else {
      toast.error(res.error);
    }
    setConfirmEliminar(null);
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-xl">
          La dirección web es de la empresa: puedes conectar la que ya tengas contratada
          y elegir qué página abre. El certificado de seguridad se activa solo.
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setNuevoOpen(true)}
          disabled={paginas.length === 0}
          title={paginas.length === 0 ? "Crea antes una página web" : undefined}
        >
          <Plus className="h-4 w-4 mr-2" /> Conectar dirección web
        </Button>
      </div>

      {paginas.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Conectar a la página:</span>
          <Select value={paginaDestino} onValueChange={setPaginaDestino}>
            <SelectTrigger className="h-9 w-[260px]">
              <SelectValue placeholder="Elige una página" />
            </SelectTrigger>
            <SelectContent>
              {paginas.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {dominios.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 flex flex-col items-center gap-3">
          <Globe className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Sin dirección web conectada. Conecta la tuya para publicar.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {dominios.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap"
            >
              <div className="min-w-0">
                <a
                  href={`https://${d.hostname}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {d.hostname}
                </a>
                <p className="text-xs text-muted-foreground">
                  Abre: {nombrePagina(d.pagina_id)}
                  {d.es_principal && " · principal"}
                </p>
                {d.dns_hint && d.estado !== "VERIFICADO" && (
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    {d.dns_hint.tipo} {d.dns_hint.name} → {d.dns_hint.value}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <EstadoDominio estado={d.estado} ssl={d.ssl_activo} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Comprobar ahora"
                  onClick={() => verificarManual(d.id)}
                  disabled={verificando === d.id}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${verificando === d.id ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600"
                  title="Desconectar"
                  onClick={() => setConfirmEliminar(d)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {paginaDestino && (
        <WizardDominioDialog
          open={nuevoOpen}
          onOpenChange={setNuevoOpen}
          paginaId={paginaDestino}
          onCompletado={cargar}
        />
      )}

      <AlertDialog
        open={!!confirmEliminar}
        onOpenChange={(o) => !o && setConfirmEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar esta dirección web?</AlertDialogTitle>
            <AlertDialogDescription>
              <code>{confirmEliminar?.hostname}</code> dejará de abrir la página. El
              dominio sigue siendo tuyo y no se toca nada en tu proveedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
