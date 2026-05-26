import Image from "next/image";
import { Link2Off } from "lucide-react";

export function InvalidLinkScreen() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12" style={{ backgroundColor: "#0a1d4a" }}>
      <div className="w-full max-w-xl text-center text-white space-y-8">
        <div className="flex justify-center">
          <Image
            src="/logo-balles.png?v=2"
            alt="Balles Hosteleros"
            width={220}
            height={60}
            className="h-12 w-auto opacity-90"
            priority
          />
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 md:p-12 space-y-6 shadow-2xl">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full flex items-center justify-center bg-white/10">
              <Link2Off className="h-8 w-8 text-white/80" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Enlace no operativo
            </h1>
            <p className="text-white/80 text-sm md:text-base leading-relaxed max-w-sm mx-auto">
              Este enlace ya no es válido o ha sido desactivado.
              Por favor, ponte en contacto con el departamento de Calidad
              para obtener uno nuevo.
            </p>
          </div>
        </div>

        <p className="text-xs text-white/50">
          © {new Date().getFullYear()} Balles Hosteleros
        </p>
      </div>
    </main>
  );
}
