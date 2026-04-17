import { ComandasBoard } from "@/features/cocina/comandas/components/ComandasBoard";
import { useComandasPermisos } from "@/features/cocina/comandas/hooks/useComandasPermisos";

export const dynamic = "force-dynamic";

export default async function ComandasPage() {
  const permisos = await useComandasPermisos();

  if (!permisos.allowed) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-2xl font-bold">Acceso al panel de Comandas no disponible</h2>
        <p className="text-muted-foreground">
          {permisos.reason ?? "No tienes permisos."}
        </p>
        <p className="text-xs text-muted-foreground">
          Usuario: {permisos.userId ?? "anónimo"} · Roles:{" "}
          {permisos.roles.length > 0 ? permisos.roles.join(", ") : "(ninguno asignado)"}
        </p>
      </div>
    );
  }

  return <ComandasBoard />;
}
