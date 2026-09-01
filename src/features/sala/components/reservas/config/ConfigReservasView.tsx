"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { useConfirmSalida } from "@/shared/components/ConfirmSalidaDialog";
import { ConfigTabReservas } from "./ConfigTabReservas";
import { TicketsTab } from "./TicketsTab";
import { EtiquetasConfigTab } from "./EtiquetasConfigTab";
import { EstructuraTab } from "./EstructuraTab";
import { OrdenAsignacionTab } from "./OrdenAsignacionTab";
import { GruposZonasTab } from "./GruposZonasTab";
import { PoliticasCancelacionTab } from "./PoliticasCancelacionTab";
import { BloqueosTab } from "@/features/sala/bloqueos/components/BloqueosTab";
import { ComunicacionesPanel } from "./ComunicacionesPanel";
import { LinksReservaPanel } from "@/features/sala/components/reservas/LinksReservaPanel";
import { CanalesTab } from "./CanalesTab";

interface Props {
  onBack: () => void;
}

export function ConfigReservasView({ onBack }: Props) {
  // Lazy: solo el tab activo se monta. Cambia de tab → componente del anterior se desmonta.
  const [tab, setTab] = useState<string>("reservas");
  // Cambiar de pestaña desmonta la anterior y se llevaría por delante lo no
  // guardado, así que primero se pregunta.
  const [hayCambiosSinGuardar, setHayCambiosSinGuardar] = useState(false);
  const { confirmarSalida, dialog: confirmSalidaDialog } = useConfirmSalida();

  const onDirtyChange = useCallback((sucio: boolean) => {
    setHayCambiosSinGuardar(sucio);
  }, []);

  /** Ninguna salida se ejecuta sin pasar por aquí. */
  const salirSiProcede = useCallback(
    async (accion: () => void) => {
      if (hayCambiosSinGuardar && !(await confirmarSalida())) return;
      setHayCambiosSinGuardar(false);
      accion();
    },
    [hayCambiosSinGuardar, confirmarSalida],
  );

  function renderTab() {
    switch (tab) {
      case "reservas":   return <ConfigTabReservas onDirtyChange={onDirtyChange} />;
      case "estructura": return <EstructuraTab />;
      case "orden":      return <OrdenAsignacionTab />;
      case "zonas":      return <GruposZonasTab />;
      case "tickets":    return <TicketsTab />;
      case "etiquetas":  return <EtiquetasConfigTab />;
      case "enlaces":    return <LinksReservaPanel embedded />;
      case "politicas":  return <PoliticasCancelacionTab />;
      case "bloqueos":   return <BloqueosTab />;
      case "comunicaciones": return <ComunicacionesPanel />;
      case "canales":    return <CanalesTab />;
      default:           return null;
    }
  }

  return (
    <div className="flex flex-col h-full">
      {confirmSalidaDialog}
      <header className="flex items-center gap-3 px-4 py-2 border-b bg-card">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => salirSiProcede(onBack)}
          className="text-xs"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Volver a reservas
        </Button>
        {hayCambiosSinGuardar && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            Cambios sin guardar
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs value={tab} onValueChange={(v) => salirSiProcede(() => setTab(v))}>
          <TabsList className="grid grid-cols-11 w-full">
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="estructura">Estructura</TabsTrigger>
            <TabsTrigger value="orden">Orden</TabsTrigger>
            <TabsTrigger value="zonas">Zonas cliente</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="etiquetas">Etiquetas</TabsTrigger>
            <TabsTrigger value="enlaces">Enlaces</TabsTrigger>
            <TabsTrigger value="politicas">Políticas</TabsTrigger>
            <TabsTrigger value="bloqueos">Bloqueos</TabsTrigger>
            <TabsTrigger value="comunicaciones">Comunicaciones</TabsTrigger>
            <TabsTrigger value="canales">Canales</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-4">{renderTab()}</div>
      </div>
    </div>
  );
}
