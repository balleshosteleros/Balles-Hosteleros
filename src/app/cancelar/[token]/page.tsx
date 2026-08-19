import type { Metadata } from "next";
import { obtenerReservaPorToken } from "@/features/reservar-publica/actions/cancelar-reserva-publica";
import { CancelarClient } from "./CancelarClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cancelar reserva",
  // Es una URL con un secreto: no debe acabar en buscadores.
  robots: { index: false, follow: false },
};

export default async function CancelarReservaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await obtenerReservaPorToken(token);

  if (!res.ok) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-gradient-to-b from-zinc-50 to-zinc-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-100 p-8 text-center space-y-2">
          <h1 className="text-xl font-bold">Enlace no válido</h1>
          <p className="text-zinc-600 text-sm">{res.error}</p>
        </div>
      </main>
    );
  }

  return <CancelarClient token={token} reserva={res.data} />;
}
