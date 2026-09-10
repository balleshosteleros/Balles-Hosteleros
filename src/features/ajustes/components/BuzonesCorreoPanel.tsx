"use client";

/**
 * Buzones auditados de la empresa (PRP-094, Fase 1).
 *
 * Aquí se decide qué correos de la empresa cuenta el software. La lista se
 * rellena sola con los correos que ya tiene la ficha de la empresa (dirección,
 * gerencia, RRHH, gestoría…), así que normalmente no hay que añadir nada: solo
 * dar permiso a los que falten.
 *
 * LA CONEXIÓN ES DE LA EMPRESA, NO DE QUIEN LA HACE. Da igual quién pulse
 * "Conectar" ni desde qué ordenador: el permiso queda a nombre del buzón. Que
 * esa persona se quite luego la cuenta de su selector no apaga nada. Eso se dice
 * en la propia pantalla, porque es justo lo que la gente teme al conectar.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { LoadingSpinner } from "@/shared/components/LoadingSpinner";
import { useConfirmDelete } from "@/shared/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import {
  listarBuzonesAction,
  desconectarBuzonAction,
  anadirBuzonAction,
  sincronizarBuzonAction,
} from "@/features/direccion/correo-auditoria/actions/buzones-actions";
import type { BuzonVista } from "@/features/direccion/correo-auditoria/types";

/** Adónde vuelve Google después de dar permiso. */
const VUELTA = "/ajustes?tab=integraciones";

export function BuzonesCorreoPanel() {
  const { empresaActual } = useEmpresa();
  const { confirm, dialog } = useConfirmDelete();

  const [buzones, setBuzones] = useState<BuzonVista[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [guardando, setGuardando] = useState(false);
  /** Buzón que se está poniendo al día ahora mismo, si hay alguno. */
  const [sincronizando, setSincronizando] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    listarBuzonesAction()
      .then(setBuzones)
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, empresaActual?.id]);

  // Al volver de Google se dice qué ha pasado. Sobre todo el caso malo: haberse
  // equivocado de cuenta en la pantalla de Google. Ahí no se guarda nada, y hay
  // que decirlo, porque si no la persona se queda pensando que ya está hecho.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resultado = params.get("google");
    if (!resultado) return;

    if (resultado === "buzon_conectado") {
      toast.success("Buzón conectado. Su correo empieza a contarse.");
    } else if (resultado === "buzon_desconocido") {
      toast.error(
        "Esa cuenta no es ninguno de los buzones de la empresa: no se ha conectado nada.",
      );
    }

    // Se limpia la dirección para que al recargar no vuelva a salir el aviso.
    params.delete("google");
    const limpia =
      window.location.pathname + (params.toString() ? `?${params}` : "");
    window.history.replaceState({}, "", limpia);
  }, []);

  const conectar = (email: string) => {
    /*
      `proposito=auditoria`: se conecta el buzón SOLO para contar su correo. No
      entra en el selector de correo de quien lo conecta ni se convierte en su
      cuenta activa — nadie tiene por qué acabar con doce bandejas ajenas encima
      por haber conectado los buzones de la empresa.

      `switch=1` hace que Google enseñe el selector de cuentas y `hint` deja ya
      marcada la del buzón: así no se conecta la equivocada por inercia.
    */
    const url =
      `/api/google/connect?proposito=auditoria&switch=1` +
      `&hint=${encodeURIComponent(email)}` +
      `&next=${encodeURIComponent(VUELTA)}`;
    window.location.href = url;
  };

  const desconectar = async (buzon: BuzonVista) => {
    const ok = await confirm({
      title: "Dejar de contar este buzón",
      description:
        `El software dejará de contar el correo de ${buzon.email}. ` +
        "Lo ya contado se conserva: solo se deja de sumar de hoy en adelante.",
      confirmLabel: "Aceptar",
      tono: "normal",
    });
    if (!ok) return;

    const res = await desconectarBuzonAction(buzon.id);
    if (!res.ok) {
      toast.error(res.error ?? "No se ha podido desconectar");
      return;
    }
    cargar();
  };

  const ponerAlDia = async (buzon: BuzonVista) => {
    setSincronizando(buzon.id);
    const res = await sincronizarBuzonAction(buzon.id);
    setSincronizando(null);

    if (!res.ok) {
      toast.error(res.error ?? "No se ha podido poner al día");
      return;
    }
    // Que queden meses por traer no es un fallo: el histórico va por tramos y
    // se completa solo. Se dice para que nadie piense que falta correo.
    toast.success(
      res.quedaHistorico
        ? `${res.guardados} correos nuevos. Sigue trayendo meses anteriores.`
        : `${res.guardados} correos nuevos.`,
    );
    cargar();
  };

  const anadir = async () => {
    setGuardando(true);
    const res = await anadirBuzonAction(nuevoEmail, nuevaEtiqueta);
    setGuardando(false);
    if (!res.ok) {
      toast.error(res.error ?? "No se ha podido añadir");
      return;
    }
    setNuevoEmail("");
    setNuevaEtiqueta("");
    cargar();
  };

  if (cargando) return <LoadingSpinner />;

  const conectados = buzones.filter((b) => b.conexion === "conectado").length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Los correos de la empresa se cuentan para saber cuánto trabajo mueve cada
        área y con quién. La conexión es de la empresa: la haga quien la haga y
        desde donde la haga, el buzón queda conectado para todos, y sigue
        contando aunque esa persona cierre sesión o deje la empresa.
      </p>
      <p className="text-xs text-muted-foreground">
        Conectar un buzón aquí <strong>no lo añade a tu correo</strong>: no verás
        su bandeja ni sus mensajes, solo se cuentan. Y solo se pueden contar
        buzones de la empresa, nunca el correo personal de nadie.
      </p>

      <div className="text-xs font-medium text-muted-foreground">
        {conectados} de {buzones.length} buzones conectados
      </div>

      <div className="divide-y rounded-md border">
        {buzones.map((buzon) => (
          <div
            key={buzon.id}
            className="flex items-center gap-3 px-3 py-2.5 text-sm"
          >
            <EstadoIcono conexion={buzon.conexion} />

            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">
                {buzon.etiqueta}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {buzon.email}
              </div>
              {buzon.conexion === "conectado" && buzon.ultimaSync ? (
                <div className="text-[11px] text-muted-foreground">
                  Al día desde {buzon.ultimaSync}
                </div>
              ) : null}
              {buzon.conexion === "caducado" ? (
                <div className="text-[11px] text-amber-700">
                  Se ha retirado el permiso en Google. Hay que volver a
                  conectarlo.
                </div>
              ) : null}
            </div>

            {buzon.conexion === "conectado" ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => ponerAlDia(buzon)}
                  disabled={sincronizando !== null}
                  aria-label="Poner al día"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${
                      sincronizando === buzon.id ? "animate-spin" : ""
                    }`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => desconectar(buzon)}
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => conectar(buzon.email)}>
                {buzon.conexion === "caducado" ? "Reconectar" : "Conectar"}
              </Button>
            )}
          </div>
        ))}

        {buzones.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Esta empresa no tiene correos en su ficha todavía.
          </div>
        ) : null}
      </div>

      {/* Buzón que no está en la ficha: un correo antiguo, el de un local… */}
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <div className="text-xs font-medium">Añadir otro buzón</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={nuevoEmail}
            onChange={(e) => setNuevoEmail(e.target.value)}
            placeholder="correo@empresa.com"
            className="sm:flex-1"
          />
          <Input
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            placeholder="Nombre en el panel"
            className="sm:w-48"
          />
          <Button
            onClick={anadir}
            disabled={guardando || !nuevoEmail.trim()}
            className="sm:w-auto"
          >
            <Plus className="mr-1 h-4 w-4" />
            Añadir
          </Button>
        </div>
      </div>

      {dialog}
    </div>
  );
}

/** Verde conectado, ámbar caducado, rojo sin conectar. Nunca un cero. */
function EstadoIcono({ conexion }: { conexion: BuzonVista["conexion"] }) {
  if (conexion === "conectado") {
    return (
      <CheckCircle2
        className="h-5 w-5 shrink-0 text-emerald-600"
        aria-label="Conectado"
      />
    );
  }
  if (conexion === "caducado") {
    return (
      <AlertTriangle
        className="h-5 w-5 shrink-0 text-amber-600"
        aria-label="Conexión caducada"
      />
    );
  }
  return (
    <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-label="Sin conectar" />
  );
}
