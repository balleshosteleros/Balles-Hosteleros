"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { type Video } from "@/shared/lib/db/schema";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatDate } from "@/shared/lib/utils";
import {
  Download,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";

const statusConfig = {
  pending: { label: "En cola", variant: "warning" as const, icon: Clock },
  processing: { label: "Procesando", variant: "info" as const, icon: Loader2 },
  completed: { label: "Listo para descargar", variant: "success" as const, icon: CheckCircle2 },
  failed: { label: "Error", variant: "destructive" as const, icon: XCircle },
};

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchVideo() {
    const res = await fetch(`/api/videos/${id}`);
    if (res.ok) {
      const data = await res.json();
      setVideo(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchVideo();
  }, [id]);

  // Poll while pending or processing
  useEffect(() => {
    if (!video || video.status === "completed" || video.status === "failed") return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/videos/${id}`);
      if (res.ok) {
        const data = await res.json();
        setVideo(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [video?.status, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="text-center py-24">
        <p className="text-muted-foreground">Video no encontrado</p>
        <Link href="/videos">
          <Button variant="outline" className="mt-4">Volver a Videos</Button>
        </Link>
      </div>
    );
  }

  const status = statusConfig[video.status];
  const StatusIcon = status.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Link href="/videos">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Mis Videos
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">{video.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Creado el {formatDate(video.createdAt)} • {video.duration}s
              </p>
            </div>
            <Badge variant={status.variant} className="gap-1 shrink-0">
              <StatusIcon className={`h-3.5 w-3.5 ${video.status === "processing" ? "animate-spin" : ""}`} />
              {status.label}
            </Badge>
          </div>

          {/* Processing state */}
          {(video.status === "pending" || video.status === "processing") && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto mb-3" />
              <h3 className="font-semibold text-blue-800 mb-1">
                {video.status === "pending" ? "En cola de render" : "Renderizando video..."}
              </h3>
              <p className="text-sm text-blue-600">
                Esta página se actualiza automáticamente. No cierres la ventana.
              </p>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={fetchVideo}
                  className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Actualizar manualmente
                </button>
              </div>
            </div>
          )}

          {/* Completed state */}
          {video.status === "completed" && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold text-green-800 mb-1">¡Video listo!</h3>
                <p className="text-sm text-green-600 mb-4">
                  Tu video ha sido generado exitosamente. Puedes descargarlo ahora.
                </p>
                {video.videoUrl && (
                  <a href={video.videoUrl} download={`${video.title}.mp4`}>
                    <Button variant="gradient" className="gap-2">
                      <Download className="h-4 w-4" />
                      Descargar MP4
                    </Button>
                  </a>
                )}
              </div>

              {video.caption && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium mb-2 text-sm">Caption generado por IA:</h4>
                    <p className="text-sm text-muted-foreground">{video.caption}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Failed state */}
          {video.status === "failed" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
              <h3 className="font-semibold text-red-800 mb-1">Error en el render</h3>
              <p className="text-sm text-red-600 mb-4">
                {video.errorMessage ?? "Hubo un problema al generar tu video."}
              </p>
              <Link href="/videos/new">
                <Button variant="outline" size="sm">Intentar de nuevo</Button>
              </Link>
            </div>
          )}

          {/* Metadata */}
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-medium mb-3">Detalles del video</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Template:</span>{" "}
                <span className="font-medium capitalize">{(video.templateId ?? "none").replace("-", " ")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duración:</span>{" "}
                <span className="font-medium">{video.duration}s</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link href="/videos/new" className="flex-1">
          <Button variant="outline" className="w-full">Crear otro video</Button>
        </Link>
        <Link href="/videos" className="flex-1">
          <Button variant="ghost" className="w-full">Ver todos mis videos</Button>
        </Link>
      </div>
    </div>
  );
}
