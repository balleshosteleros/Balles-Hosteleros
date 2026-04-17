import { listProductosPOS } from "@/features/sala/pos/actions/productos-pos-actions";
import { POSShell } from "@/features/sala/pos/components/POSShell";
import { usePOSPermisos } from "@/features/sala/pos/hooks/usePOSPermisos";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const permisos = await usePOSPermisos();

  if (!permisos.allowed) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-2xl font-bold">Acceso al POS no disponible</h2>
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

  const res = await listProductosPOS();
  const productos = res.ok ? res.data : [];
  const errorMsg = res.ok ? null : res.error;

  if (errorMsg) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-2xl font-bold text-destructive">Error cargando productos</h2>
        <pre className="max-w-xl overflow-auto rounded bg-muted p-3 text-xs">
          {errorMsg}
        </pre>
      </div>
    );
  }

  return (
    <>
      {productos.length === 0 && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-sm text-amber-900">
          ⚠️ No hay productos tipo <strong>venta</strong> activos para esta empresa.
          Ve a <a href="/logistica/productos" className="underline font-semibold">Logística → Productos</a> para crearlos.
        </div>
      )}
      <POSShell productos={productos} />
    </>
  );
}
