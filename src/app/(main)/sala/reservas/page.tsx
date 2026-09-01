import { ReservasView } from "@/features/sala/components/ReservasView";

// Igual que `/sala`. Sin esto, `/sala` (force-dynamic) y `/sala/reservas` se
// cacheaban distinto en el router del navegador: el hermano estaba siempre
// listo para pintarse y Reservas no, así que al pulsar RESERVAS asomaban las
// gráficas de SALA antes de llegar.
export const dynamic = "force-dynamic";

export default function ReservasPage() {
  return <ReservasView />;
}
