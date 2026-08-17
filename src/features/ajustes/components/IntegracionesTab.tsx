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
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { getAgoraIntegracion } from "@/features/ajustes/actions/agora-integracion-actions";
import { getEmpresaPlaceInfo } from "@/features/calidad/actions/resenas-actions";
import {
  IntegracionLogo,
  type IntegracionLogoKey,
} from "@/features/ajustes/components/IntegracionLogo";
import { FichaGooglePanel } from "@/features/ajustes/components/FichaGooglePanel";
import { AgoraPanel } from "@/features/ajustes/components/AgoraPanel";

/** Estado de conexión de cada integración. */
type EstadoConexion = "conectado" | "sin_conectar" | "proximamente";

interface IntegracionDef {
  key: string;
  nombre: string;
  /** Una línea: qué hace por el negocio, sin tecnicismos. */
  resumen: string;
  logo: IntegracionLogoKey;
  /** Las "próximamente" no se pueden abrir todavía. */
  proximamente?: boolean;
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
    key: "highlevel",
    nombre: "GoHighLevel",
    resumen: "Marketing y reputación.",
    logo: "highlevel",
    proximamente: true,
  },
  {
    key: "b2com",
    nombre: "B2COM",
    resumen: "Centralita telefónica de la empresa.",
    logo: "b2com",
    proximamente: true,
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
    Promise.all([getEmpresaPlaceInfo(), getAgoraIntegracion()]).then(
      ([place, agora]) => {
        setEstados({
          google: place?.googlePlaceId ? "conectado" : "sin_conectar",
          agora:
            agora.ok && agora.estado.activo && agora.estado.tieneToken
              ? "conectado"
              : "sin_conectar",
          highlevel: "proximamente",
          b2com: "proximamente",
        });
        setCargando(false);
      },
    );
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
      <div>
        <h2 className="text-base font-semibold text-foreground">Integraciones</h2>
        <p className="text-sm text-muted-foreground">
          Conecta tu empresa con servicios externos. Cada empresa gestiona sus
          propias claves; afectan solo a la empresa activa del selector.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRACIONES.map((integracion) => {
          const estado = integracion.proximamente
            ? "proximamente"
            : (estados[integracion.key] ?? "sin_conectar");
          const bloqueada = integracion.proximamente;

          return (
            <Card
              key={integracion.key}
              role={bloqueada ? undefined : "button"}
              tabIndex={bloqueada ? undefined : 0}
              aria-disabled={bloqueada}
              onClick={() => {
                if (!bloqueada) setAbierta(integracion.key);
              }}
              onKeyDown={(e) => {
                if (bloqueada) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAbierta(integracion.key);
                }
              }}
              className={
                "relative flex h-full flex-col gap-3 p-4 transition " +
                (bloqueada
                  ? "opacity-60"
                  : "cursor-pointer hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")
              }
            >
              {/* Distintivo de estado, arriba a la derecha: verde = listo,
                  rojo = falta conectar. Es lo primero que se ve. */}
              <span className="absolute right-3 top-3">
                {cargando && !bloqueada ? (
                  <span className="block h-5 w-5 animate-pulse rounded-full bg-muted" />
                ) : estado === "conectado" ? (
                  <CheckCircle2
                    className="h-5 w-5 text-emerald-600"
                    aria-label="Conectado"
                  />
                ) : estado === "proximamente" ? (
                  <Clock
                    className="h-5 w-5 text-muted-foreground"
                    aria-label="Próximamente"
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
                {cargando && !bloqueada ? (
                  <span className="text-muted-foreground">Comprobando…</span>
                ) : estado === "conectado" ? (
                  <span className="text-emerald-700">Conectado</span>
                ) : estado === "proximamente" ? (
                  <span className="text-muted-foreground">Próximamente</span>
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
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
