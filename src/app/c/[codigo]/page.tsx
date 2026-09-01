/**
 * Ruta corta /c/[codigo] — el enlace de cancelar que cabe en un SMS.
 *
 * El enlace largo (/cancelar/<uuid>) ocupa 76 caracteres y deja los avisos por
 * encima de los 160 de un SMS, que es donde el precio se dobla. Con el código
 * corto el enlace baja a unos 44 y el mensaje cabe en uno solo.
 *
 * Aquí no se cancela nada: se traduce el código a su token y se redirige a la
 * pantalla de siempre, para que la lógica de cancelación viva en un único
 * sitio y no haya dos comportamientos que mantener.
 *
 * Anónima: quien entra es un cliente sin cuenta en el sistema.
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cancelar reserva",
  // Es una URL con un secreto: no debe acabar en buscadores.
  robots: { index: false, follow: false },
};

export default async function CancelarPorCodigoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;

  // El código sale de un alfabeto cerrado: cualquier otra cosa es un enlace
  // manipulado y no merece ni tocar la base de datos.
  const limpio = codigo.trim().toUpperCase();
  if (!/^[23456789A-HJKMNP-Z]{8}$/.test(limpio)) {
    return <EnlaceNoValido />;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("reservas")
    .select("cancelacion_token")
    .eq("cancelacion_codigo", limpio)
    .maybeSingle();

  const token = data?.cancelacion_token as string | null | undefined;
  if (!token) return <EnlaceNoValido />;

  redirect(`/cancelar/${token}`);
}

function EnlaceNoValido() {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-gradient-to-b from-zinc-50 to-zinc-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-100 p-8 text-center space-y-2">
        <h1 className="text-xl font-bold">Enlace no válido</h1>
        <p className="text-zinc-600 text-sm">
          Este enlace no corresponde a ninguna reserva. Puede que ya se haya
          cancelado o que el enlace esté incompleto.
        </p>
      </div>
    </main>
  );
}
