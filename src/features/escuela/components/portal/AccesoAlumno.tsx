"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pedirCodigo, entrarConCodigo } from "../../actions/portal-actions";
import type { MarcaEscuela } from "../../services/portal-alumno";
import { GoogleAlumno } from "./GoogleAlumno";

/**
 * Entrada del alumno.
 *
 * Se lee igual que el acceso del software —formulario a la izquierda, marca a la
 * derecha— porque es la misma casa; lo que cambia es de quién es la marca: aquí
 * manda la escuela, no el software de gestión.
 *
 * Dos maneras de entrar y ninguna con contraseña: la cuenta de Google (la de
 * siempre, como en el portal de antes) o un código de seis cifras al correo. El
 * alta la hace la escuela desde dentro: aquí no se registra nadie. Si el correo
 * no está dado de alta, el camino del código se comporta igual que si lo
 * estuviera —pide el código— para no ir confirmando qué correos existen; con
 * Google sí se dice, porque quien llega ya ha demostrado que el correo es suyo.
 */
export function AccesoAlumno({ marca }: { marca: MarcaEscuela }) {
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

  const logo = marca.isotipoUrl || marca.logoUrl;

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Izquierda: por dónde se entra. */}
      <div className="flex w-full flex-col justify-between px-6 py-10 lg:w-1/2 lg:px-16">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            {/* En móvil no hay panel de marca: el logotipo del máster va aquí,
                en pequeño, para que la pantalla no empiece en seco y el alumno
                vea dónde está entrando. */}
            <div className="mb-9 flex items-center gap-4 lg:hidden">
              <span className="text-4xl font-light leading-none tracking-tight text-white">
                MDH
              </span>
              <span className="h-10 w-px bg-white/25" />
              <span className="text-[0.65rem] font-light uppercase leading-relaxed tracking-[0.18em] text-blue-200/80">
                Máster en dirección
                <br />y gestión hostelera
              </span>
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
                    className="h-12 w-full text-base"
                    style={{ background: marca.color, color: marca.colorTexto }}
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
                  className="h-12 w-full text-base"
                  style={{ background: marca.color, color: marca.colorTexto }}
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

        <footer className="mt-10 text-center text-xs text-slate-500">
          Escuela {marca.nombre}
        </footer>
      </div>

      {/* Derecha: la marca de la escuela. Solo en pantalla grande, igual que en
          el acceso del software. */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-950 to-slate-950" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147,197,253,0.2) 0%, transparent 50%)",
          }}
        />

        {/* El logotipo del máster, montado como en su portada: las siglas, una
            línea que las separa, y el nombre desplegado al lado. */}
        <div className="relative z-10 flex w-full flex-col items-center justify-center px-12">
          <div className="flex items-center gap-6">
            <span className="animate-marca-desde-arriba text-[5.5rem] font-light leading-none tracking-tight text-white motion-reduce:animate-none">
              MDH
            </span>
            <div className="h-24 w-px animate-marca-separador bg-white/30 motion-reduce:animate-none" />
            <span className="animate-marca-desde-abajo text-sm font-light uppercase leading-relaxed tracking-[0.22em] text-blue-200/80 motion-reduce:animate-none">
              Máster en
              <br />
              dirección y
              <br />
              gestión hostelera
            </span>
          </div>

          {/* La casa, debajo y sin robar protagonismo: el máster es de la
              escuela, y conviene que se vea de quién. */}
          {logo ? (
            <span className="relative mt-16 block h-12 w-12 overflow-hidden rounded-xl bg-white/95 shadow-lg shadow-black/20">
              <Image
                src={logo}
                alt={marca.nombre}
                fill
                sizes="48px"
                className="object-contain p-1.5"
              />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
