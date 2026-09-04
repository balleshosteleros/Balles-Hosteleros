import type { Metadata } from "next";
import { iconsDeEmpresa } from "@/shared/lib/favicon-empresa";
import { obtenerReservaPorTokenReconfirmacion } from "@/features/reservar-publica/actions/reconfirmar-reserva-publica";
import { ReconfirmarClient } from "./ReconfirmarClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  // La empresa sale del propio token de la reserva: el cliente ve el icono de
  // SU restaurante en la pestana, no el del software.
  const { token } = await params;
  const res = await obtenerReservaPorTokenReconfirmacion(token);
  return {
    title: "Confirmar reserva",
    // Es una URL con un secreto: no debe acabar en buscadores.
    robots: { index: false, follow: false },
    icons: await iconsDeEmpresa({ id: res.ok ? res.data.empresaId : "" }),
  };
}

export default async function ReconfirmarReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r } = await searchParams;
  const res = await obtenerReservaPorTokenReconfirmacion(token);

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

  // Qué botón pulsó en el correo. Solo preselecciona la respuesta: NO se aplica
  // nada aquí. El correo lo abre un cliente de correo que puede precargar
  // enlaces, y una reserva no puede cancelarse porque Gmail mire la URL.
  const intencion = r === "no" ? "no" : r === "si" ? "si" : null;

  return (
    <ReconfirmarClient token={token} reserva={res.data} intencion={intencion} />
  );
}
