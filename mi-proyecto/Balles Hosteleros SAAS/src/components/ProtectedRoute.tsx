import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, canAccess } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccess(location.pathname)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <h2 className="text-xl font-bold text-foreground">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">No tienes permisos para acceder a este módulo.</p>
          <p className="text-xs text-muted-foreground">Contacta con tu administrador para solicitar acceso.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
