import { auth } from "@/shared/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { users } from "@/shared/lib/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Info } from "lucide-react";

export const metadata = { title: "Configuración — ReelForge Recorder" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu perfil y preferencias del grabador.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tu Perfil</CardTitle>
          <CardDescription>Información básica de tu cuenta local.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col py-3 border-b">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Nombre</span>
            <span className="font-medium">{user?.name ?? "Sin nombre"}</span>
          </div>
          <div className="flex flex-col py-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Email de acceso</span>
            <span className="font-medium">{user?.email}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-100 bg-blue-50/50">
        <CardHeader>
          <div className="flex items-center gap-2 text-blue-700">
            <Info className="h-5 w-5" />
            <CardTitle className="text-lg">Privacidad y Almacenamiento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-blue-700 space-y-3">
          <p>
            <strong>ReelForge Recorder</strong> está diseñado para funcionar de forma local. Tus grabaciones no se suben a la nube por defecto.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li>Los videos se guardan en el servidor donde corre la app.</li>
            <li>No hay límites de tiempo ni de cantidad de grabaciones.</li>
            <li>Tus datos son procesados localmente en tu navegador.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
