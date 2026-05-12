import { ScreenRecorder } from "@/features/recorder/components/ScreenRecorder";
import { Monitor, Info } from "lucide-react";

export const metadata = { title: "Grabar Pantalla — ReelForge Recorder" };

export default function RecordPage() {
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 gradient-bg rounded-xl flex items-center justify-center shrink-0">
          <Monitor className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Grabar pantalla</h1>
          <p className="text-muted-foreground mt-1">
            Graba tu pantalla, reuniones de Meet/Zoom y tutoriales de formación.
            Similar a Loom, sin depender de servicios externos.
          </p>
        </div>
      </div>

      {/* Browser compatibility notice */}
      <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-6 text-sm text-blue-700">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Funciona en Chrome, Edge y Firefox. Requiere HTTPS o localhost.
          Las grabaciones se guardan en{" "}
          <code className="text-xs bg-blue-100 px-1 rounded">captures/recordings/</code>{" "}
          dentro del proyecto.
        </span>
      </div>

      <ScreenRecorder />
    </div>
  );
}
