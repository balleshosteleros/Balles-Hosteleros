"use client";

/**
 * Integraciones de la empresa con servicios externos (PRP-059).
 *
 * Rejilla de tarjetas del MISMO tamaño, una por servicio, con su logo y un
 * distintivo de estado bien visible: check verde si la conexión está lista,
 * marca roja si no. De un vistazo se ve qué falta por conectar sin tener que
 * leer nada.
 *
 * La configuración de cada una se abre en un diálogo al pulsar su tarjeta, en
 * vez de vivir desplegada en la página: así todas ocupan lo mismo y la lista
 * no crece a lo largo según se añaden integraciones.
 *
 * Cada empresa configura sus propias claves; afectan solo a la empresa activa.
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getAgoraIntegracion } from "@/features/ajustes/actions/agora-integracion-actions";
import { getEmpresaPlaceInfo } from "@/features/calidad/actions/resenas-actions";
import {
  IntegracionLogo,
  type IntegracionLogoKey,
} from "@/features/ajustes/components/IntegracionLogo";
import { FichaGooglePanel } from "@/features/ajustes/components/FichaGooglePanel";
import { AgoraPanel } from "@/features/ajustes/components/AgoraPanel";
import { RevolutPanel } from "@/features/ajustes/components/RevolutPanel";
import { MetaPanel } from "@/features/ajustes/components/MetaPanel";
import { getMetaEstadoAction } from "@/features/marketing/meta-ads/actions/cuenta-actions";
import { getRevolutConfig } from "@/features/ajustes/actions/revolut-config-actions";
import { BuzonesCorreoPanel } from "@/features/ajustes/components/BuzonesCorreoPanel";
import { listarBuzonesAction } from "@/features/direccion/correo-auditoria/actions/buzones-actions";

/** Estado de conexión de cada integración. */
type EstadoConexion = "conectado" | "sin_conectar";

interface IntegracionDef {
  key: string;
  nombre: string;
  /** Una línea: qué hace por el negocio, sin tecnicismos. */
  resumen: string;
  logo: IntegracionLogoKey;
}

const INTEGRACIONES: IntegracionDef[] = [
  {
    key: "google",
    nombre: "Google",
    resumen: "Reseñas de tu ficha, contestadas por la IA.",
    logo: "google",
  },
  {
    key: "agora",
    nombre: "Ágora POS",
    resumen: "Importa cada día las ventas de tu TPV.",
    logo: "agora",
  },
  {
    key: "revolut",
    nombre: "Revolut",
    resumen: "Cobra por adelantado las reservas y los tickets.",
    logo: "revolut",
  },
  {
    key: "meta",
    nombre: "Meta",
    resumen: "Lleva los anuncios de Facebook e Instagram desde Marketing.",
    logo: "meta",
  },
  {
    key: "correo",
    nombre: "Correo",
    resumen: "Cuenta el correo de cada área y con quién habla.",
    logo: "gmail",
  },
];

export function IntegracionesTab() {
  const { empresaActual } = useEmpresa();
  const empresaId = empresaActual?.id;

  const [estados, setEstados] = useState<Record<string, EstadoConexion>>({});
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<string | null>(null);

  // Se recarga al cambiar de empresa y al cerrar un diálogo, para que el
  // distintivo refleje lo que se acabe de conectar sin recargar la página.
  const cargarEstados = () => {
    setCargando(true);
    Promise.all([
      getEmpresaPlaceInfo(),
      getAgoraIntegracion(),
      getRevolutConfig(),
      getMetaEstadoAction(),
      listarBuzonesAction(),
    ]).then(([place, agora, revolut, meta, buzones]) => {
      setEstados({
        google: place?.googlePlaceId ? "conectado" : "sin_conectar",
        agora:
          agora.ok && agora.estado.activo && agora.estado.tieneToken
            ? "conectado"
            : "sin_conectar",
        // Conectado solo si además del alta hay webhook: sin él los pagos
        // entran pero el software no se entera, así que no está listo.
        revolut:
          revolut.configurado && revolut.activo && revolut.webhookConfigurado
            ? "conectado"
            : "sin_conectar",
        // Conectado solo cuando además de la cuenta hay tope de gasto y está
        // activa: sin tope no se puede lanzar nada, así que no está lista.
        meta:
          meta.ok && meta.data.activo && meta.data.adAccountId
            ? "conectado"
            : "sin_conectar",
        // Conectado en cuanto haya AL MENOS un buzón dando datos: con uno solo
        // el panel de auditoría ya dice algo. Cuántos faltan se ve al abrirlo.
        correo: buzones.some((b) => b.conexion === "conectado")
          ? "conectado"
          : "sin_conectar",
      });
      setCargando(false);
    });
  };

  useEffect(() => {
    cargarEstados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const cerrarDialogo = () => {
    setAbierta(null);
    cargarEstados();
  };

  const integracionAbierta = INTEGRACIONES.find((i) => i.key === abierta);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRACIONES.map((integracion) => {
          const estado = estados[integracion.key] ?? "sin_conectar";
          const conectado = estado === "conectado";

          return (
            <Card
              key={integracion.key}
              role="button"
              tabIndex={0}
              onClick={() => setAbierta(integracion.key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAbierta(integracion.key);
                }
              }}
              className="relative flex h-full cursor-pointer flex-col gap-3 p-4 transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Distintivo de estado, arriba a la derecha: verde = listo,
                  rojo = falta conectar. Es lo primero que se ve. */}
              <span className="absolute right-3 top-3">
                {cargando ? (
                  <span className="block h-5 w-5 animate-pulse rounded-full bg-muted" />
                ) : conectado ? (
                  <CheckCircle2
                    className="h-5 w-5 text-emerald-600"
                    aria-label="Conectado"
                  />
                ) : (
                  <XCircle
                    className="h-5 w-5 text-red-600"
                    aria-label="Sin conectar"
                  />
                )}
              </span>

              <IntegracionLogo
                logo={integracion.logo}
                nombre={integracion.nombre}
              />

              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {integracion.nombre}
                </div>
                <p className="text-xs text-muted-foreground">
                  {integracion.resumen}
                </p>
              </div>

              <div className="mt-auto pt-1 text-xs font-medium">
                {cargando ? (
                  <span className="text-muted-foreground">Comprobando…</span>
                ) : conectado ? (
                  <span className="text-emerald-700">Conectado</span>
                ) : (
                  <span className="text-red-600">Sin conectar</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={abierta !== null}
        onOpenChange={(open) => {
          if (!open) cerrarDialogo();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {integracionAbierta ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <IntegracionLogo
                    logo={integracionAbierta.logo}
                    nombre={integracionAbierta.nombre}
                    size={24}
                  />
                  {integracionAbierta.nombre}
                </DialogTitle>
                <DialogDescription>
                  {integracionAbierta.resumen}
                </DialogDescription>
              </DialogHeader>

              {abierta === "google" ? <FichaGooglePanel /> : null}
              {abierta === "agora" ? <AgoraPanel /> : null}
              {abierta === "revolut" ? <RevolutPanel /> : null}
              {abierta === "meta" ? <MetaPanel /> : null}
              {abierta === "correo" ? <BuzonesCorreoPanel /> : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
