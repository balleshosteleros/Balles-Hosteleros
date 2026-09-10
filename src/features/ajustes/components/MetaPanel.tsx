"use client";

/**
 * PRP-087 · Configuración de Meta (Facebook + Instagram) en Ajustes → Integraciones.
 *
 * Dos momentos bien separados:
 *  1. Conectar con Facebook — se sale al diálogo de Meta y se vuelve con el acceso.
 *  2. Elegir cuenta publicitaria, página y tope de gasto — con listas leídas de
 *     la API, sin teclear ningún identificador.
 *
 * El acceso guardado no vuelve nunca al navegador: aquí solo se ven nombres.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NumberInput } from "@/shared/components/NumberInput";
import { Loader2, AtSign, AlertTriangle, Unplug } from "lucide-react";
import { IntegracionLogo } from "@/features/ajustes/components/IntegracionLogo";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  desconectarMetaAction,
  getMetaEstadoAction,
  guardarCuentaMetaAction,
  iniciarConexionMetaAction,
  listarActivosMetaAction,
} from "@/features/marketing/meta-ads/actions/cuenta-actions";
import type {
  CuentaPublicitaria,
  PaginaFacebook,
} from "@/features/marketing/meta-ads/services/meta-oauth";

/** Qué contarle al usuario según cómo haya vuelto de Facebook. */
const AVISOS_VUELTA: Record<string, { tipo: "ok" | "error"; texto: string }> = {
  conectado: { tipo: "ok", texto: "Cuenta de Meta conectada. Ahora elige la cuenta publicitaria y el tope de gasto." },
  cancelado: { tipo: "error", texto: "Has cancelado la conexión con Facebook." },
  sin_codigo: { tipo: "error", texto: "Facebook no ha devuelto la autorización. Vuelve a intentarlo." },
  estado_invalido: { tipo: "error", texto: "La conexión ha caducado por seguridad. Vuelve a empezar." },
  sin_empresa: { tipo: "error", texto: "No se ha podido saber a qué empresa conectar la cuenta." },
  sin_sesion: { tipo: "error", texto: "Tu sesión ha caducado. Entra de nuevo y vuelve a intentarlo." },
  canje_fallido: { tipo: "error", texto: "Facebook ha rechazado la autorización. Vuelve a intentarlo." },
  no_guardado: { tipo: "error", texto: "No se ha podido guardar la conexión. Inténtalo de nuevo." },
};

export function MetaPanel() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [cargando, setCargando] = useState(true);
  const [appConfigurada, setAppConfigurada] = useState(true);
  const [conectado, setConectado] = useState(false);
  const [activo, setActivo] = useState(false);
  const [nombreCuenta, setNombreCuenta] = useState<string | null>(null);
  const [diasParaCaducar, setDiasParaCaducar] = useState<number | null>(null);

  const [cuentas, setCuentas] = useState<CuentaPublicitaria[]>([]);
  const [paginas, setPaginas] = useState<PaginaFacebook[]>([]);
  const [cargandoActivos, setCargandoActivos] = useState(false);

  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [tope, setTope] = useState(0);

  const [conectando, setConectando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarEstado = useCallback(async () => {
    setCargando(true);
    const res = await getMetaEstadoAction();
    if (res.ok) {
      setAppConfigurada(res.data.appConfigurada);
      setConectado(res.data.conectado);
      setActivo(res.data.activo);
      setNombreCuenta(res.data.nombreCuenta);
      setDiasParaCaducar(res.data.diasParaCaducar);
      setAdAccountId(res.data.adAccountId ?? "");
      setTope((res.data.topeGastoMensualCent ?? 0) / 100);
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargarEstado();
  }, [cargarEstado, empresaId]);

  // Aviso de cómo ha ido la vuelta de Facebook, y se limpia el parámetro para
  // que no vuelva a saltar al recargar.
  useEffect(() => {
    const resultado = searchParams.get("meta");
    if (!resultado) return;
    const aviso = AVISOS_VUELTA[resultado];
    if (aviso) {
      if (aviso.tipo === "ok") toast.success(aviso.texto);
      else toast.error(aviso.texto);
    }
    router.replace("/ajustes?tab=integraciones", { scroll: false });
  }, [searchParams, router]);

  // Cuando hay acceso, se piden las cuentas y páginas que ese acceso alcanza.
  useEffect(() => {
    if (!conectado) return;
    let vivo = true;
    setCargandoActivos(true);
    listarActivosMetaAction().then((res) => {
      if (!vivo) return;
      if (res.ok) {
        setCuentas(res.data.cuentas);
        setPaginas(res.data.paginas);
        // Si solo hay una de cada, se elige sola: no tiene sentido hacer
        // elegir entre una única opción.
        if (res.data.cuentas.length === 1 && !adAccountId) setAdAccountId(res.data.cuentas[0].id);
        if (res.data.paginas.length === 1 && !pageId) setPageId(res.data.paginas[0].id);
      } else {
        toast.error(res.error);
      }
      setCargandoActivos(false);
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectado, empresaId]);

  const conectar = async () => {
    setConectando(true);
    const res = await iniciarConexionMetaAction();
    if (res.ok) {
      window.location.href = res.data.url;
      return;
    }
    setConectando(false);
    toast.error(res.error);
  };

  const guardar = async () => {
    setGuardando(true);
    const res = await guardarCuentaMetaAction({
      adAccountId,
      pageId,
      topeGastoMensualEuros: tope,
      activo,
    });
    setGuardando(false);
    if (res.ok) {
      toast.success("Conexión de Meta guardada.");
      void cargarEstado();
    } else {
      toast.error(res.error);
    }
  };

  const desconectar = async () => {
    setGuardando(true);
    const res = await desconectarMetaAction();
    setGuardando(false);
    if (res.ok) {
      toast.success("Cuenta de Meta desconectada. Lo que haya en marcha sigue corriendo en Meta.");
      setCuentas([]);
      setPaginas([]);
      setPageId("");
      void cargarEstado();
    } else {
      toast.error(res.error);
    }
  };

  if (cargando) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!appConfigurada) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
          Falta dar de alta la aplicación de Meta
        </p>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300/80">
          El software necesita su propia aplicación en Meta antes de que ninguna empresa pueda conectar su
          cuenta publicitaria. Es un paso que se hace una sola vez para todo el software.
        </p>
      </div>
    );
  }

  const paginaElegida = paginas.find((p) => p.id === pageId);
  const puedeGuardar = Boolean(adAccountId) && Boolean(pageId) && tope > 0;

  return (
    <div className="space-y-4">
      {!conectado ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Conecta la cuenta de Facebook que administra la publicidad de{" "}
            <span className="font-medium text-foreground">{empresaActual?.nombre}</span>. Después podrás ver y
            lanzar los anuncios de Facebook e Instagram desde Marketing.
          </p>
          <Button onClick={conectar} disabled={conectando} className="gap-2">
            {conectando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IntegracionLogo logo="meta" nombre="Meta" size={16} />
            )}
            Conectar con Facebook
          </Button>
        </div>
      ) : (
        <>
          {diasParaCaducar !== null && diasParaCaducar <= 7 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800 dark:text-amber-300/80">
                {diasParaCaducar < 0
                  ? "La conexión con Meta ha caducado. Vuelve a conectar para que los datos se sigan actualizando."
                  : `La conexión con Meta caduca en ${diasParaCaducar} día(s). Vuelve a conectar para no quedarte sin datos.`}
              </p>
            </div>
          )}

          {cargandoActivos ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Leyendo tus cuentas en Meta…
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Cuenta publicitaria</Label>
                <Select value={adAccountId} onValueChange={setAdAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige la cuenta que paga los anuncios" />
                  </SelectTrigger>
                  <SelectContent>
                    {cuentas.map((c) => (
                      <SelectItem key={c.id} value={c.id} disabled={!c.utilizable}>
                        {c.nombre}
                        {!c.utilizable ? " · no activa en Meta" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {cuentas.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Esta cuenta de Facebook no administra ninguna cuenta publicitaria.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Página de Facebook</Label>
                <Select value={pageId} onValueChange={setPageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige la página del negocio" />
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

              {/* El Instagram no se elige: es el que Meta dice que está vinculado
                  a esa página. Si no lo hay, hay que avisarlo aquí y no dejar que
                  se descubra cuando el anuncio no salga en Instagram. */}
              {paginaElegida && (
                <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
                  <AtSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  {paginaElegida.instagramUsuario ? (
                    <p className="text-xs text-muted-foreground">
                      Instagram vinculado:{" "}
                      <span className="font-medium text-foreground">@{paginaElegida.instagramUsuario}</span>. Los
                      anuncios podrán salir también en Instagram.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Esta página no tiene ninguna cuenta de Instagram profesional vinculada, así que los
                      anuncios solo podrán salir en Facebook. Se vincula desde el Business Manager de Meta.
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Tope de gasto al mes (€)</Label>
                <NumberInput min={0} value={tope} onValueChange={setTope} />
                <p className="text-xs text-muted-foreground">
                  Al llegar a esta cifra no se podrá activar ninguna campaña más este mes. Cuenta todo lo que
                  gaste la cuenta publicitaria, también lo que se lance desde Meta.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Integración activa</p>
                  <p className="text-xs text-muted-foreground">
                    {nombreCuenta ? `Cuenta conectada: ${nombreCuenta}` : "Sin activar todavía"}
                  </p>
                </div>
                <Switch checked={activo} onCheckedChange={setActivo} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={guardar} disabled={guardando || !puedeGuardar}>
                  {guardando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Guardar
                </Button>
                <Button variant="outline" onClick={conectar} disabled={conectando} className="gap-2">
                  <IntegracionLogo logo="meta" nombre="Meta" size={16} />
                  Volver a conectar
                </Button>
                <Button variant="ghost" onClick={desconectar} disabled={guardando} className="gap-2 text-destructive">
                  <Unplug className="h-4 w-4" />
                  Desconectar
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
