import { ClientesView } from "@/features/sala/components/ClientesView";

// Misma vista de CLIENTES que en Sala: en la empresa matriz vive dentro de
// PRODUCTO, que es donde tiene sentido el seguimiento de quien contrata el
// software. Una sola pantalla, dos hogares según la empresa.
export const dynamic = "force-dynamic";

export default function ProductoClientesPage() {
  return <ClientesView />;
}
