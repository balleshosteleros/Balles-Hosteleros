import { getMiFichajeHoy } from "@/features/mi-panel/actions/mi-panel-actions";
import { BigClockButton } from "@/features/mi-panel/mobile/components/BigClockButton";

export const dynamic = "force-dynamic";

type Estado = "sin-fichar" | "trabajando" | "pausa" | "completado";

function deriveEstado(fichajeHoy: Awaited<ReturnType<typeof getMiFichajeHoy>>["data"]): Estado {
  if (!fichajeHoy) return "sin-fichar";
  const e = (fichajeHoy.estado || "").toLowerCase();
  if (e === "trabajando") return "trabajando";
  if (e === "pausa") return "pausa";
  if (e === "completado" || fichajeHoy.horaSalida) return "completado";
  return "sin-fichar";
}

export default async function FicharPage() {
  const res = await getMiFichajeHoy();
  const fichajeHoy = res.data;
  const estado = deriveEstado(fichajeHoy);

  return (
    <>
      <header className="px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <h1 className="text-xl font-semibold">Fichar</h1>
        {fichajeHoy?.horaEntrada && (
          <p className="text-sm text-muted-foreground">
            Entrada: {new Date(fichajeHoy.horaEntrada).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
            {fichajeHoy.horaSalida && (
              <> · Salida: {new Date(fichajeHoy.horaSalida).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</>
            )}
          </p>
        )}
      </header>
      <BigClockButton fichajeId={fichajeHoy?.id ?? null} estado={estado} />
    </>
  );
}
