import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, FileImage, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onFileReady: (file: File) => void;
}

export function AlbaranUploadModal({ open, onClose, onFileReady }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File | null) => {
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = () => {
    if (file) {
      onFileReady(file);
      reset();
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Asociar albarán del proveedor</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Upload className="h-10 w-10 text-primary" />
              <span className="text-sm font-semibold text-foreground">Adjuntar archivo</span>
              <span className="text-xs text-muted-foreground text-center">PDF, imagen o foto del albarán</span>
            </button>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Camera className="h-10 w-10 text-primary" />
              <span className="text-sm font-semibold text-foreground">Abrir cámara</span>
              <span className="text-xs text-muted-foreground text-center">Hacer foto al albarán del proveedor</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="relative rounded-lg overflow-hidden border bg-muted/30">
              {file?.type.startsWith("image/") ? (
                <img src={preview} alt="Preview albarán" className="w-full max-h-[300px] object-contain" />
              ) : (
                <div className="flex items-center justify-center gap-3 p-8">
                  <FileImage className="h-10 w-10 text-primary" />
                  <div>
                    <p className="font-medium text-foreground text-sm">{file?.name}</p>
                    <p className="text-xs text-muted-foreground">{((file?.size || 0) / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-2 h-7 w-7 bg-background/80 hover:bg-background"
                onClick={reset}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={reset}>Cambiar archivo</Button>
              <Button onClick={handleSubmit} className="gap-1">
                <Loader2 className="h-4 w-4 animate-spin hidden" />
                Analizar albarán
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
