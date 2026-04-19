import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Panel izquierdo: formulario */}
      <div className="flex w-full flex-col justify-between px-6 py-10 lg:w-1/2 lg:px-16">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">{children}</div>
        </div>

        {/* Footer */}
        <footer className="mt-10 flex flex-col items-center justify-between gap-2 text-xs text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Balles Hosteleros</span>
          <a
            href="mailto:info@balleshosteleros.com"
            className="transition-colors hover:text-slate-300"
          >
            info@balleshosteleros.com
          </a>
        </footer>
      </div>

      {/* Panel derecho: marca (solo desktop) */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        {/* Gradiente de fondo */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950" />

        {/* Patrón decorativo sutil */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147,197,253,0.2) 0%, transparent 50%)",
          }}
        />

        {/* Contenido central: logo + wordmark */}
        <div className="relative z-10 flex w-full flex-col items-center justify-center px-12">
          <div className="flex items-center gap-6">
            <div className="relative h-44 w-44 shrink-0">
              <Image
                src="/logo-balles.png"
                alt="Balles Hosteleros"
                fill
                priority
                className="object-contain"
              />
            </div>
            <div className="h-32 w-px bg-white/30" />
            <span className="text-sm font-light uppercase tracking-[0.28em] text-blue-200/80">
              Software de Gestión
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
