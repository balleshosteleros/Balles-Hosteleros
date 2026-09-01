import { ClientesView } from "@/features/sala/components/ClientesView";

// La ficha se puede pedir por URL (`?cliente=<id>`, desde el listado de Sala),
// así que la vista lee los parámetros de búsqueda: sin render dinámico, la
// prerenderización estática fallaría al construir.
export const dynamic = "force-dynamic";

export default function ClientesPage() {
  return <ClientesView />;
}
