import { auth } from "@/shared/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { videos, users } from "@/shared/lib/db/schema";
import { eq, desc, count, and, sum } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { VideoCard } from "@/features/videos/components/VideoCard";
import {
  Video,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  Plus,
  Monitor,
} from "lucide-react";

export const metadata = { title: "Dashboard — ReelForge Recorder" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const recentRecordings = await db
    .select()
    .from(videos)
    .where(and(eq(videos.userId, userId), eq(videos.type, "recording")))
    .orderBy(desc(videos.createdAt))
    .limit(6);

  const [{ total }] = await db
    .select({ total: count() })
    .from(videos)
    .where(and(eq(videos.userId, userId), eq(videos.type, "recording")));

  const [{ totalSeconds }] = await db
    .select({ totalSeconds: sum(videos.duration) })
    .from(videos)
    .where(and(eq(videos.userId, userId), eq(videos.type, "recording")));

  const minutes = Math.floor((Number(totalSeconds) || 0) / 60);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Hola, {session.user.name?.split(" ")[0] ?? "amigo"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus grabaciones de pantalla y tutoriales.
          </p>
        </div>
        <Link href="/record">
          <Button variant="gradient" size="lg" className="gap-2">
            <Monitor className="h-5 w-5" />
            Nueva Grabación
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Grabaciones Totales
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Registros en sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tiempo de Grabación
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{minutes} min</div>
            <p className="text-xs text-muted-foreground mt-1">
              Tiempo total grabado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent recordings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Grabaciones recientes</h2>
          <Link href="/videos">
            <Button variant="ghost" size="sm">Ver todas →</Button>
          </Link>
        </div>

        {recentRecordings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 gradient-bg rounded-2xl flex items-center justify-center mb-4">
                <Monitor className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Aún no tienes grabaciones</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Empieza a grabar tu pantalla para crear tutoriales, demos o reuniones grabadas.
              </p>
              <Link href="/record">
                <Button variant="gradient" size="lg" className="gap-2">
                  <Monitor className="h-5 w-5" />
                  Iniciar primera grabación
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentRecordings.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
