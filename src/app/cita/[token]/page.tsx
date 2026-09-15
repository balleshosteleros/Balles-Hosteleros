import { CalendarX2 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { datosCitaParaCorreo, ciudadDeZona } from "@/features/producto/citas/services/datos-cita";
import { CitaPublicaView } from "./CitaPublicaView";

/**
 * La cita de quien la reservó, abierta con el enlace de su correo (PRP-088).
 *
 * Sin sesión: viene de un embudo y no tiene cuenta. La llave es el token, que
 * solo está en su correo.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function citaDelToken(token: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("citas")
    .select("id, estado, inicio")
    .eq("token_gestion", token)
    .maybeSingle();
  const fila = (data as { id: string; estado: string; inicio: string } | null) ?? null;
  if (!fila) return null;
  // El "¿ya pasó?" se resuelve aquí, fuera del render: mirar el reloj mientras
  // se pinta la pantalla haría que el mismo componente diera dos resultados.
  return { ...fila, yaPaso: new Date(fila.inicio).getTime() < Date.now() };
}

export default async function CitaPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cita = await citaDelToken(token);
  const datos = cita ? await datosCitaParaCorreo(cita.id) : null;

  if (!cita || !datos) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <CalendarX2 className="mx-auto h-10 w-10 text-rose-500" />
          <h1 className="mt-3 text-lg font-semibold text-zinc-900">Enlace no válido</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Este enlace no corresponde a ninguna cita. Comprueba que lo has copiado entero.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CitaPublicaView
      token={token}
      empresaNombre={datos.marca.nombre}
      color={datos.marca.color ?? "#0f172a"}
      calendario={datos.calendario}
      fechaLarga={datos.fechaLarga}
      hora={datos.hora}
      ciudadZona={ciudadDeZona(datos.zona)}
      meetUrl={datos.meetUrl}
      yaAnulada={cita.estado === "CANCELADA"}
      yaPaso={cita.yaPaso}
    />
  );
}

export const metadata = { title: "Tu cita" };
