import { LayoutDashboard } from "lucide-react";

export function DashboardView() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-12">
      <div className="rounded-2xl bg-card border p-12 text-center max-w-md">
        <LayoutDashboard className="h-16 w-16 mx-auto mb-4 text-primary/40" />
        <h2 className="text-2xl font-bold text-foreground mb-2">DASHBOARD</h2>
        <p className="text-muted-foreground">Panel principal con indicadores clave del negocio.</p>
      </div>
    </div>
  );
}
