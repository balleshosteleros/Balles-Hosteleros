import Image from "next/image";
import Link from "next/link";
import { TITULAR } from "@/app/software/legal/datos-titular";

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
          <div className="w-full max-w-[400px]">{children}</div>
        </div>

        {/* Footer.
            Los enlaces legales son REQUISITO de la verificación OAuth de
            Google: el revisor busca la política de privacidad desde la misma
            pantalla donde se pide el acceso, no solo en la web comercial. */}
        <footer className="mt-10 flex flex-col items-center gap-3 text-xs text-slate-500">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              href="/legal/privacidad"
              className="transition-colors hover:text-slate-300"
            >
              Privacidad
            </Link>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <Link
              href="/legal/terminos"
              className="transition-colors hover:text-slate-300"
            >
              Términos
            </Link>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <Link
              href="/legal/cookies"
              className="transition-colors hover:text-slate-300"
            >
              Cookies
            </Link>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <Link
              href="/legal/aviso-legal"
              className="transition-colors hover:text-slate-300"
            >
              Aviso legal
            </Link>
          </nav>

          {/* NINGÚN correo en esta pantalla (decisión de Iván): la dirección de
              contacto vive solo en el aviso legal, que es donde la LSSI la
              exige y adonde llega el revisor de Google desde el enlace de
              arriba. Aquí va el nombre registrado del software, no la razón
              social de la sociedad, y el año de inicio de la actividad. */}
          <span className="text-center">
            © {TITULAR.anioInicio}–{new Date().getFullYear()} {TITULAR.nombreRegistrado}
          </span>
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

        {/* Contenido central: logo + wordmark, en horizontal y separados por
            una línea vertical (así estaba y así se queda).
            El logo lleva medidas explícitas (no `fill`) para que ocupe lo mismo
            antes y después de cargar: con `fill` el hueco depende del contenedor
            y la imagen "aparecía" de distinto tamaño según el entorno. */}
        <div className="relative z-10 flex w-full flex-col items-center justify-center px-12">
          <div className="flex items-center gap-6">
            <Image
              src="/logo-balles.png"
              alt={TITULAR.razonSocial}
              width={176}
              height={176}
              priority
              className="h-44 w-44 shrink-0 object-contain"
            />
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
