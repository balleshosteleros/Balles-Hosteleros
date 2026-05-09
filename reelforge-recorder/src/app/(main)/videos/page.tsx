import { auth } from "@/shared/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { videos } from "@/shared/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { VideoCard } from "@/features/videos/components/VideoCard";
import { Plus, Video, Monitor } from "lucide-react";

export const metadata = { title: "Grabaciones — ReelForge Recorder" };

export default async function VideosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  
  const allRecordings = await db
    .select()
    .from(videos)
    .where(and(eq(videos.userId, session.user.id), eq(videos.type, "recording")))
    .orderBy(desc(videos.createdAt));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Grabaciones</h1>
          <p className="text-muted-foreground mt-1">
            {allRecordings.length} grabación{allRecordings.length !== 1 ? "es" : ""} guardada{allRecordings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/record">
          <Button variant="gradient" className="gap-2">
            <Monitor className="h-4 w-4" />
            Nueva Grabación
          </Button>
        </Link>
      </div>

      {allRecordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 gradient-bg rounded-2xl flex items-center justify-center mb-4">
            <Monitor className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Sin grabaciones aún</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Empieza a grabar tu pantalla para guardar tutoriales, demos o reuniones localmente.
          </p>
          <Link href="/record">
            <Button variant="gradient" size="lg" className="gap-2">
              <Monitor className="h-5 w-5" />
              Grabar mi primera pantalla
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {allRecordings.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
