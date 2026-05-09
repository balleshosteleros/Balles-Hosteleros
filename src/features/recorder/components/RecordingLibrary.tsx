"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Play, 
  Download, 
  Trash2, 
  Clock, 
  Calendar, 
  Search,
  Filter,
  MoreVertical,
  Edit2,
  Copy,
  Check,
  FileVideo,
  Loader2,
  ChevronRight,
  ExternalLink,
  Grid,
  List as ListIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { formatDuration } from "../hooks/useScreenRecorder";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Recording {
  id: string;
  title: string;
  url: string;
  duration: number;
  file_size: number;
  created_at: string;
}

export function RecordingLibrary() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  async function fetchRecordings() {
    try {
      const res = await fetch("/api/recordings");
      if (res.ok) {
        const data = await res.json();
        setRecordings(data);
      }
    } catch (err) {
      toast.error("Error al cargar grabaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecordings();
  }, []);

  const filteredRecordings = useMemo(() => {
    return recordings.filter(rec => 
      rec.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [recordings, search]);

  async function handleDelete(id: string) {
    if (!confirm("¿Estás seguro de eliminar esta grabación?")) return;
    
    try {
      const res = await fetch("/api/recordings", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setRecordings(prev => prev.filter(r => r.id !== id));
        toast.success("Grabación eliminada");
      }
    } catch (err) {
      toast.error("Error al eliminar");
    }
  }

  async function handleRename(id: string) {
    if (!editTitle.trim()) return;
    try {
      const res = await fetch("/api/recordings", {
        method: "PATCH",
        body: JSON.stringify({ id, title: editTitle }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRecordings(prev => prev.map(r => r.id === id ? updated : r));
        setEditingId(null);
        toast.success("Título actualizado");
      }
    } catch (err) {
      toast.error("Error al renombrar");
    }
  }

  function handleCopyLink(recording: Recording) {
    const shareUrl = `${window.location.origin}${recording.url}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copiado al portapapeles");
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="relative">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Sincronizando biblioteca...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 lg:p-8 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Mi Biblioteca</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona tus {recordings.length} grabaciones de ReelForge
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Buscar grabaciones..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-[240px] lg:w-[320px] bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-xl"
            />
          </div>
          <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50">
            <Button 
              variant={viewMode === "grid" ? "secondary" : "ghost"} 
              size="icon" 
              className="h-8 w-8 rounded-lg"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="icon" 
              className="h-8 w-8 rounded-lg"
              onClick={() => setViewMode("list")}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {filteredRecordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-card/30 rounded-3xl border border-dashed border-border/50">
          <div className="w-20 h-20 bg-primary/5 rounded-3xl flex items-center justify-center mb-4 ring-1 ring-primary/10">
            <FileVideo className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="text-lg font-semibold">No se encontraron grabaciones</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-[280px] text-center">
            {search ? `No hay resultados para "${search}"` : "Comienza a grabar para ver tus videos aquí."}
          </p>
          {search && (
            <Button variant="link" onClick={() => setSearch("")} className="mt-2 text-primary">
              Limpiar búsqueda
            </Button>
          )}
        </div>
      ) : (
        <div className={cn(
          "grid gap-6",
          viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
        )}>
          {filteredRecordings.map((rec) => (
            <Card key={rec.id} className="group overflow-hidden border-border/40 bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 rounded-2xl">
              {/* Thumbnail Area */}
              <div className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer" onClick={() => window.open(rec.url, '_blank')}>
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10 backdrop-blur-[2px]">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center ring-1 ring-white/50 scale-90 group-hover:scale-100 transition-transform">
                    <Play className="h-6 w-6 text-white fill-white" />
                  </div>
                </div>
                
                {/* Stats overlays */}
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-20">
                  <Badge variant="outline" className="bg-black/60 backdrop-blur-md text-white border-none text-[10px] py-0 h-5 px-1.5 font-medium">
                    {formatDuration(rec.duration)}
                  </Badge>
                  <Badge variant="outline" className="bg-black/60 backdrop-blur-md text-white border-none text-[10px] py-0 h-5 px-1.5 font-medium">
                    {formatSize(rec.file_size)}
                  </Badge>
                </div>
                
                {/* Placeholder thumbnail pattern */}
                <div className="absolute inset-0 opacity-20 flex items-center justify-center">
                  <FileVideo className="h-12 w-12 text-white" />
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  {editingId === rec.id ? (
                    <div className="flex-1 flex gap-2">
                      <Input 
                        value={editTitle} 
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="h-8 text-sm focus-visible:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(rec.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRename(rec.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm truncate leading-tight group-hover:text-primary transition-colors">
                        {rec.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground/80 font-medium">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(rec.created_at).toLocaleDateString()}
                        </div>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0 hover:bg-muted/50">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-xl">
                      <DropdownMenuItem className="gap-2 py-2 cursor-pointer" onClick={() => window.open(rec.url, '_blank')}>
                        <ExternalLink className="h-4 w-4 text-primary" />
                        Ver video
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 py-2 cursor-pointer" onClick={() => handleCopyLink(rec)}>
                        <Copy className="h-4 w-4 text-blue-500" />
                        Copiar link
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 py-2 cursor-pointer" onClick={() => {
                        setEditingId(rec.id);
                        setEditTitle(rec.title);
                      }}>
                        <Edit2 className="h-4 w-4 text-amber-500" />
                        Renombrar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="gap-2 py-2 cursor-pointer text-destructive focus:text-destructive" 
                        onClick={() => handleDelete(rec.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>

              <CardFooter className="px-4 pb-4 pt-0 gap-2">
                <a href={rec.url} download={`${rec.title}.webm`} className="flex-1">
                  <Button variant="outline" className="w-full h-9 rounded-xl text-xs gap-2 border-border/50 hover:bg-primary/5 hover:border-primary/50 transition-all font-semibold">
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </Button>
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
