"use client";

import { type Video } from "@/shared/lib/db/schema";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { formatRelativeTime } from "@/shared/lib/utils";
import {
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  Monitor,
  Sparkles,
} from "lucide-react";

interface VideoCardProps {
  video: Video;
}

const statusConfig = {
  pending: { label: "En cola", variant: "warning" as const, icon: Clock },
  processing: { label: "Procesando", variant: "info" as const, icon: Loader2 },
  completed: { label: "Listo", variant: "success" as const, icon: CheckCircle2 },
  failed: { label: "Error", variant: "destructive" as const, icon: XCircle },
};

export function VideoCard({ video }: VideoCardProps) {
  const status = statusConfig[video.status];
  const StatusIcon = status.icon;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all group">
      {/* Thumbnail */}
      <div className="relative h-40 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-700">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <Monitor className="h-12 w-12 text-white/70" />
        )}

        {/* Processing overlay */}
        {video.status === "processing" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm font-medium">Guardando...</p>
            </div>
          </div>
        )}

        {/* Play hover for completed */}
        {video.status === "completed" && video.videoUrl && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-all">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                <Play className="h-5 w-5 text-primary ml-0.5" />
              </div>
            </div>
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          <Badge className="text-xs bg-black/40 text-white backdrop-blur-sm border-0 gap-1">
            <Monitor className="h-3 w-3" />
            Grabación
          </Badge>
        </div>

        {/* Duration */}
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
            {video.duration}s
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-sm line-clamp-1 flex-1">{video.title}</h3>
          <Badge variant={status.variant} className="shrink-0 gap-1 text-xs">
            <StatusIcon
              className={`h-3 w-3 ${video.status === "processing" ? "animate-spin" : ""}`}
            />
            {status.label}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mb-3">
          {formatRelativeTime(video.createdAt)}
          {video.fileSize ? ` • ${(video.fileSize / 1_000_000).toFixed(1)} MB` : ""}
        </p>

        {video.status === "completed" && video.videoUrl && (
          <div className="flex gap-2">
            <a href={video.videoUrl} download={`${video.title}.webm`} className="flex-1">
              <Button variant="premium" size="sm" className="w-full gap-2 py-5">
                <Download className="h-4 w-4" />
                Descargar
              </Button>
            </a>
          </div>
        )}

        {video.status === "failed" && (
          <div className="space-y-2">
            <p className="text-[10px] text-destructive font-medium line-clamp-1 text-center bg-destructive/5 py-1 rounded">
              {video.errorMessage ?? "Error al guardar grabación"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
