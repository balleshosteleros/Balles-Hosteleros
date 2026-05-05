"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Globe, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  listarDominios,
  verificarDominio,
} from "../../../actions/dominios-actions";
import { AnadirDominioDialog } from "./AnadirDominioDialog";
import { EstadoDominio } from "./EstadoDominio";
import type { PaginaWebDominio } from "../../../types";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";

interface Props {
  paginaId: string;
  nombrePagina: string;
}

export function DominiosPanel({ paginaId, nombrePagina }: Props) {
  const [dominios, setDominios] = useState<PaginaWebDominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState<PaginaWebDominio | null>(null);
  const [verificando, setVerificando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    const res = await listarDominios(paginaId);
    if (res.ok) setDominios(res.data);
    else toast.error(res.error);
    setLoading(false);
  }, [paginaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Polling cada 15s si hay dominios pendientes de verificar
  useEffect(() => {
    if (!dominios.some((d) => d.estado !== "VERIFICADO")) return;
    const t = setInterval(() => {
      Promise.all(
        dominios
          .filter((d) => d.estado !== "VERIFICADO")
          .map((d) => verificarDominio(d.id)),
      ).then(() => cargar());
    }, 15_000);
    return () => clearInterval(t);
  }, [dominios, cargar]);

  const verificarManual = async (id: string) => {
    setVerificando(id);
    const res = await verificarDominio(id);
    if (res.ok) {
      if (res.data.estado === "VERIFICADO") toast.success("Dominio verificado ✅");
      else toast.message("Aún pendiente de DNS. Revisa los registros.");
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
      toast.success("Dominio eliminado");
      cargar();
    } else {
      toast.error(res.error);
    }
    setConfirmEliminar(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href={`/marketing/pagina-web/${paginaId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Editor
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Globe className="h-6 w-6" /> Dominios
            </h1>
            <p className="text-sm text-muted-foreground">
              {nombrePagina} — asocia uno o más dominios propios con SSL automático.
            </p>
          </div>
        </div>
        <Button variant="primary" size="lg" onClick={() => setNuevoOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Añadir dominio
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hostname</TableHead>
              <TableHead>DNS recomendado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <LoadingSpinner />
                </TableCell>
              </TableRow>
            )}
            {!loading && dominios.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Globe className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      Sin dominios asociados. Añade uno para publicar la web.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              dominios.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <a
                      href={`https://${d.hostname}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {d.hostname}
                    </a>
                    {d.es_principal && (
                      <span className="ml-2 text-xs text-muted-foreground">(principal)</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.dns_hint ? (
                      <>
                        <span className="font-semibold">{d.dns_hint.tipo}</span>{" "}
                        <span className="text-muted-foreground">{d.dns_hint.name}</span>{" "}
                        → <span>{d.dns_hint.value}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <EstadoDominio estado={d.estado} ssl={d.ssl_activo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Verificar ahora"
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
                        title="Eliminar"
                        onClick={() => setConfirmEliminar(d)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <AnadirDominioDialog
        open={nuevoOpen}
        onOpenChange={setNuevoOpen}
        paginaId={paginaId}
        onAdded={cargar}
      />

      <AlertDialog
        open={!!confirmEliminar}
        onOpenChange={(o) => !o && setConfirmEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar dominio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desasocia <code>{confirmEliminar?.hostname}</code> de esta página y se
              elimina de Vercel. Los DNS en tu registrador no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
