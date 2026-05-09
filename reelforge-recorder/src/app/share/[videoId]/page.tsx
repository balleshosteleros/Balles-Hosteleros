import { notFound } from "next/navigation";
import { db } from "@/shared/lib/db";
import { videos } from "@/shared/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { formatDate } from "@/shared/lib/utils";
import { Download, Monitor, Sparkles, Clock } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  const [video] = await db
    .select({ title: videos.title })
    .from(videos)
    .where(or(eq(videos.id, videoId), eq(videos.shareToken, videoId)))
    .limit(1);

  return {
    title: video ? `${video.title} — ReelForge Recorder` : "Video — ReelForge Recorder",
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;

  const [video] = await db
    .select()
    .from(videos)
    .where(or(eq(videos.id, videoId), eq(videos.shareToken, videoId)))
    .limit(1);

  if (!video || (!video.isPublic && video.status !== "completed")) {
    notFound();
  }

  const isRecording = video.type === "recording";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 gradient-bg rounded-lg flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white">ReelForge Recorder</span>
          </div>
          {video.videoUrl && (
            <a
              href={video.videoUrl}
              download={`${video.title}.${isRecording ? "webm" : "mp4"}`}
              className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Download className="h-4 w-4" />
              Descargar
            </a>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-3xl space-y-6">
          {/* Video info */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isRecording ? (
                <span className="inline-flex items-center gap-1.5 text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full">
                  <Monitor className="h-3 w-3" />
                  Grabación
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs bg-violet-500/20 text-violet-400 px-2.5 py-1 rounded-full">
                  <Sparkles className="h-3 w-3" />
                  Generado con IA
                </span>
              )}
              {video.duration && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-white/10 text-gray-400 px-2.5 py-1 rounded-full">
                  <Clock className="h-3 w-3" />
                  {video.duration}s
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-white">{video.title}</h1>
            <p className="text-sm text-gray-400 mt-1">
              Creado el {formatDate(video.createdAt)}
            </p>
          </div>

          {/* Video player */}
          {video.videoUrl ? (
            <div className="rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10">
              <video
                src={video.videoUrl}
                controls
                className="w-full aspect-video"
                preload="metadata"
              />
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 aspect-video flex items-center justify-center">
              <p className="text-gray-400">El video no está disponible</p>
            </div>
          )}

          {/* Caption if present */}
          {video.caption && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Caption IA</p>
              <p className="text-gray-200 text-sm leading-relaxed">{video.caption}</p>
            </div>
          )}

          {/* Footer CTA */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-500 mb-3">
              ¿Quieres crear videos como este?
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 gradient-bg text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              <Sparkles className="h-4 w-4" />
              Prueba ReelForge Recorder gratis
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
