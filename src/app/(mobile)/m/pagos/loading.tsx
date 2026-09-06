import { Loader2 } from "lucide-react";

// `force-dynamic` sin este archivo hace que al pulsar "Pagos" no pase nada
// visible hasta que el servidor responde: parece que el toque no ha entrado.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
