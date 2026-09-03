import { Suspense } from "react";
import { PedidosView } from "@/features/logistica/components/PedidosView";

export default function PedidosPage() {
  // Suspense: PedidosView usa useSearchParams (?albaran= para abrir directo
  // un albarán desde Acuerdos), y sin él Next falla al prerenderizar.
  return (
    <Suspense fallback={null}>
      <PedidosView />
    </Suspense>
  );
}
