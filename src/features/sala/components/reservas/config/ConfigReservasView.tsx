"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { useConfirmSalida } from "@/shared/components/ConfirmSalidaDialog";
// Cada pestaña se descarga SOLO al abrirla.
//
// Antes se importaban las doce de golpe: aunque en pantalla se pintara una
// sola, el navegador tenía que bajarse y procesar el código de todas —incluido
// el editor de planos, que es con diferencia lo más pesado del módulo— antes de
// enseñar nada. Por eso Configuración tardaba tanto en abrir y parecía colgada.
// Ahora entra al momento y cada pestaña trae lo suyo cuando se pulsa.
const CargandoPanel = () => (
  <div className="flex items-center justify-center py-16">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
  </div>
);

const ConfigTabReservas = dynamic(() => import("./ConfigTabReservas").then((m) => m.ConfigTabReservas), { loading: CargandoPanel });
const TicketsTab = dynamic(() => import("./TicketsTab").then((m) => m.TicketsTab), { loading: CargandoPanel });
const EtiquetasConfigTab = dynamic(() => import("./EtiquetasConfigTab").then((m) => m.EtiquetasConfigTab), { loading: CargandoPanel });
const EstructuraTab = dynamic(() => import("./EstructuraTab").then((m) => m.EstructuraTab), { loading: CargandoPanel });
const OrdenAsignacionTab = dynamic(() => import("./OrdenAsignacionTab").then((m) => m.OrdenAsignacionTab), { loading: CargandoPanel });
const GruposZonasTab = dynamic(() => import("./GruposZonasTab").then((m) => m.GruposZonasTab), { loading: CargandoPanel });
const PoliticasCancelacionTab = dynamic(() => import("./PoliticasCancelacionTab").then((m) => m.PoliticasCancelacionTab), { loading: CargandoPanel });
const BloqueosTab = dynamic(() => import("@/features/sala/bloqueos/components/BloqueosTab").then((m) => m.BloqueosTab), { loading: CargandoPanel });
const ComunicacionesPanel = dynamic(() => import("./ComunicacionesPanel").then((m) => m.ComunicacionesPanel), { loading: CargandoPanel });
const LinksReservaPanel = dynamic(() => import("@/features/sala/components/reservas/LinksReservaPanel").then((m) => m.LinksReservaPanel), { loading: CargandoPanel });
const CanalesTab = dynamic(() => import("./CanalesTab").then((m) => m.CanalesTab), { loading: CargandoPanel });
const MonederoPanel = dynamic(() => import("@/features/mensajeria/components/MonederoPanel").then((m) => m.MonederoPanel), { loading: CargandoPanel });

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
      case "monedero":   return <MonederoPanel />;
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
          <TabsList className="grid grid-cols-12 w-full">
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
            <TabsTrigger value="monedero">Monedero</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-4">{renderTab()}</div>
      </div>
    </div>
  );
}
