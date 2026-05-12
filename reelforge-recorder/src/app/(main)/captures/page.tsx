import { auth } from "@/shared/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/shared/lib/db";
import { videos } from "@/shared/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import Link from "next/link";
import { readdir, stat } from "fs/promises";
import path from "path";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { formatDate, formatRelativeTime } from "@/shared/lib/utils";
import {
  Monitor,
  Sparkles,
  Download,
  FolderOpen,
  FileVideo,
  Image,
  FileCode,
  Camera,
} from "lucide-react";

export const metadata = { title: "Archivos — ReelForge Recorder" };

const CAPTURES_DIR = path.join(process.cwd(), "captures");

async function getFolderStats(subdir: string) {
  try {
    const dirPath = path.join(CAPTURES_DIR, subdir);
    const files = await readdir(dirPath);
    const filtered = files.filter((f) => !f.startsWith("."));
    let totalSize = 0;
    for (const file of filtered) {
      try {
        const s = await stat(path.join(dirPath, file));
        totalSize += s.size;
      } catch { /* skip */ }
    }
    return { count: filtered.length, size: totalSize };
  } catch {
    return { count: 0, size: 0 };
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export default async function CapturesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Grabaciones del usuario en DB
  const recordings = await db
    .select()
    .from(videos)
    .where(and(eq(videos.userId, session.user.id), eq(videos.type, "recording")))
    .orderBy(desc(videos.createdAt))
    .limit(50);

  // Stats de carpetas en disco
  const [recStats, thumbStats, screenshotStats] =
    await Promise.all([
      getFolderStats("recordings"),
      getFolderStats("thumbnails"),
      getFolderStats("screenshots"),
    ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Archivos Locales</h1>
        <p className="text-muted-foreground mt-1">
          Las grabaciones se guardan localmente en la carpeta{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
            captures/
          </code>{" "}
          para máxima privacidad.
        </p>
      </div>

      {/* Folder overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Grabaciones", icon: Monitor, dir: "recordings", stats: recStats, color: "text-red-500" },
          { label: "Miniaturas", icon: Image, dir: "thumbnails", stats: thumbStats, color: "text-blue-500" },
          { label: "Capturas de pantalla", icon: Camera, dir: "screenshots", stats: screenshotStats, color: "text-green-500" },
        ].map(({ label, icon: Icon, dir, stats, color }) => (
          <Card key={dir}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <p className="text-2xl font-bold">{stats.count}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(stats.size)}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1 text-[10px]">
                /captures/{dir}/
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recordings list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5 text-red-500" />
            Historial de Grabaciones
          </h2>
          <Link href="/record">
            <Button variant="outline" size="sm" className="gap-2">
              <Monitor className="h-4 w-4" />
              Nueva grabación
            </Button>
          </Link>
        </div>

        {recordings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Monitor className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Sin grabaciones</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Empieza a grabar tu pantalla para generar tus primeros archivos locales.
              </p>
              <Link href="/record">
                <Button variant="gradient">Grabar pantalla ahora</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordings.map((v) => (
              <CaptureCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CaptureCard({ video }: { video: typeof videos.$inferSelect }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-all group">
      <div className="h-32 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 relative">
        <Monitor className="h-12 w-12 text-white/50" />
        <Badge className="absolute top-2 left-2 bg-black/50 border-0">REC</Badge>
      </div>
      <CardContent className="p-4">
        <h3 className="font-medium text-sm line-clamp-1 mb-1">{video.title}</h3>
        <p className="text-xs text-muted-foreground mb-3">
          {formatRelativeTime(video.createdAt)}
        </p>
        
        <div className="space-y-2">
          {video.duration && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold">
              <span>Duración</span>
              <span>{video.duration}s</span>
            </div>
          )}
          {video.fileSize && (
            <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase font-semibold border-t pt-1">
              <span>Tamaño</span>
              <span>{(video.fileSize / 1_000_000).toFixed(1)} MB</span>
            </div>
          )}
        </div>

        {video.videoUrl && (
          <a href={video.videoUrl} download className="mt-4 block">
            <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Descargar archivo
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
