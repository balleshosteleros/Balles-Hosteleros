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
            <div className="relative mb-9 h-24 overflow-hidden rounded-xl lg:hidden">
              <Image
                src="/logo-master-mdh.webp"
                alt="Máster en dirección hostelera"
                fill
                sizes="100vw"
                priority
                className="object-cover object-center"
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
        </footer>
      </div>

      {/* Derecha: el logotipo del máster. Solo en pantalla grande, igual que en
          el acceso del software.

          Es el arte OFICIAL tal cual salió del diseñador —con su degradado y sus
          letras—, no una imitación montada con tipografía: cualquier parecido
          aproximado se nota al lado del material del máster. Se sirve a pantalla
          completa para que no haya costuras entre la imagen y el fondo. */}
      <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:w-1/2">
        <Image
          src="/logo-master-mdh.webp"
          alt="Máster en dirección hostelera"
          fill
          sizes="50vw"
          priority
          className="animate-marca-desde-abajo object-cover object-center motion-reduce:animate-none"
        />
      </div>
    </div>
  );
}
