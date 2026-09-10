"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TITULAR } from "@/app/software/legal/datos-titular";
import { pedirCodigo, entrarConCodigo } from "../../actions/portal-actions";
import { GoogleAlumno } from "./GoogleAlumno";

/**
 * Entrada del alumno.
 *
 * Se lee igual que el acceso del software —formulario a la izquierda, marca a la
 * derecha— porque es la misma casa; lo que cambia es de quién es la marca: aquí
 * manda el máster, no el software de gestión. Por eso NO se pinta con los
 * colores de la empresa: el logotipo trae los suyos y mezclarlos los ensucia.
 *
 * Dos maneras de entrar y ninguna con contraseña: la cuenta de Google (la de
 * siempre, como en el portal de antes) o un código de seis cifras al correo. El
 * alta la hace la escuela desde dentro: aquí no se registra nadie. Si el correo
 * no está dado de alta, el camino del código se comporta igual que si lo
 * estuviera —pide el código— para no ir confirmando qué correos existen; con
 * Google sí se dice, porque quien llega ya ha demostrado que el correo es suyo.
 */
export function AccesoAlumno() {
  const router = useRouter();
  const [paso, setPaso] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const mostrarError = useCallback((mensaje: string) => setError(mensaje), []);

  async function enviarCorreo(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const res = await pedirCodigo(email);
    setCargando(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo enviar el código.");
      return;
    }
    setPaso("codigo");
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCargando(true);
    const res = await entrarConCodigo(email, codigo);
    setCargando(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo entrar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Izquierda: por dónde se entra. */}
      <div className="flex w-full flex-col justify-between px-6 py-10 lg:w-1/2 lg:px-16">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            {/* En móvil no hay panel de marca: el logotipo oficial va aquí
                arriba, para que la pantalla no empiece en seco y el alumno vea
                dónde está entrando. */}
            <div className="mb-9 flex justify-center lg:hidden">
              <Image
                src="/logo-master-blanco.webp"
                alt="Máster en dirección y gestión hostelera"
                width={260}
                height={39}
                priority
                className="h-auto w-[260px]"
              />
            </div>

            <h1 className="text-2xl font-semibold text-white">
              {paso === "email" ? "Entra en la escuela" : "Revisa tu correo"}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {paso === "email"
                ? "Con tu cuenta de Google o con un código al correo. Sin contraseñas."
                : `Hemos enviado un código de seis cifras a ${email}.`}
            </p>

            {paso === "email" ? (
              <div className="mt-8 space-y-5">
                <GoogleAlumno onError={mostrarError} />

                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <span className="text-xs uppercase tracking-widest text-slate-500">o</span>
                  <span className="h-px flex-1 bg-white/10" />
                </div>

                <form onSubmit={enviarCorreo} className="space-y-3">
                  <Input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                  />
                  {error ? <p className="text-sm text-red-300">{error}</p> : null}
                  <Button
                    type="submit"
                    disabled={cargando}
                    className="h-12 w-full bg-blue-600 text-base font-semibold text-white shadow-lg shadow-blue-900/30 hover:bg-blue-500"
                  >
                    {cargando ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Enviarme el código
                  </Button>
                </form>
              </div>
            ) : (
              <form onSubmit={entrar} className="mt-8 space-y-3">
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  className="h-14 border-white/10 bg-white/5 text-center text-2xl tracking-[0.5em] text-white placeholder:text-slate-600"
                  required
                  autoFocus
                />
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
                <Button
                  type="submit"
                  disabled={cargando || codigo.length !== 6}
                  className="h-12 w-full bg-blue-600 text-base font-semibold text-white shadow-lg shadow-blue-900/30 hover:bg-blue-500"
                >
                  {cargando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Entrar
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setPaso("email");
                    setCodigo("");
                    setError("");
                  }}
                  className="w-full text-center text-sm text-slate-400 transition-colors hover:text-white"
                >
                  Usar otro correo
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Los enlaces legales son REQUISITO de la verificación de Google: el
            revisor los busca en la misma pantalla donde se pide entrar con una
            cuenta, no solo en la web. Van al mismo sitio que los del acceso del
            software. */}
        <footer className="mt-10 flex flex-col items-center gap-3 text-xs text-slate-500">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link href="/legal/privacidad" className="transition-colors hover:text-slate-300">
              Privacidad
            </Link>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <Link href="/legal/terminos" className="transition-colors hover:text-slate-300">
              Términos
            </Link>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <Link href="/legal/cookies" className="transition-colors hover:text-slate-300">
              Cookies
            </Link>
            <span aria-hidden className="text-slate-700">
              ·
            </span>
            <Link href="/legal/aviso-legal" className="transition-colors hover:text-slate-300">
              Aviso legal
            </Link>
          </nav>
          <span className="text-center">
            © {TITULAR.anioFundacion} {TITULAR.nombreRegistrado}
          </span>
          {/* La misma firma que cierra las webs del grupo: pequeña y en segundo
              plano, porque esta pantalla es del máster, no del software. */}
          <span className="text-center text-[11px] text-slate-600">
            Tecnología por{" "}
            <a
              href="https://software.balleshosteleros.com"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium transition-colors hover:text-slate-400"
            >
              Software Balles Hosteleros
            </a>
          </span>
        </footer>
      </div>

      {/* Derecha: la marca, montada IGUAL que en el acceso del software —el
          mismo fondo azul y el logotipo del mismo tamaño— porque es la misma
          casa. Antes se servía el arte a sangre con `object-cover` y el
          logotipo salía enorme, muy por encima de lo que ocupa el de Balles.

          El logotipo va en blanco sobre transparente y con medidas explícitas
          (no `fill`) para que ocupe lo mismo antes y después de cargar. */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147,197,253,0.2) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 flex w-full flex-col items-center justify-center px-12">
          <Image
            src="/logo-master-blanco.webp"
            alt="Máster en dirección y gestión hostelera"
            width={400}
            height={59}
            priority
            className="h-auto w-[400px] animate-marca-desde-abajo motion-reduce:animate-none"
          />
        </div>
      </div>
    </div>
  );
}
