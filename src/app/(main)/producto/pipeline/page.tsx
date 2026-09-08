import { PipelineView } from "@/features/producto/pipeline/components/PipelineView";

// El tablero se carga desde el cliente con las acciones del módulo, así que la
// página solo lo monta. `force-dynamic` para que no se sirva cacheada con las
// oportunidades de otra empresa activa.
export const dynamic = "force-dynamic";

export default function ProductoPipelinePage() {
  return <PipelineView />;
}
