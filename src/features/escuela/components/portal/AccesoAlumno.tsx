"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pedirCodigo, entrarConCodigo } from "../../actions/portal-actions";
import type { MarcaEscuela } from "../../services/portal-alumno";

/**
 * Entrada del alumno: correo → código de seis cifras.
 *
 * Sin contraseñas y sin registro: el alta la hace la escuela desde dentro. Si el
 * correo no está dado de alta, la pantalla se comporta igual que si lo estuviera
 * —pide el código— para no ir confirmando qué correos existen.
 */
export function AccesoAlumno({ marca }: { marca: MarcaEscuela }) {
  const router = useRouter();
  const [paso, setPaso] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

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
    <div
      className="flex min-h-screen items-center justify-center bg-muted/30 px-4"
      style={
        {
          "--marca-primario": marca.color,
          "--marca-texto": marca.colorTexto,
        } as React.CSSProperties
      }
    >
      <div className="w-full max-w-sm rounded-2xl border bg-background p-7 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          {marca.logoUrl || marca.isotipoUrl ? (
            <span className="relative h-16 w-16 overflow-hidden rounded-xl bg-white ring-1 ring-black/5">
              <Image
                src={(marca.logoUrl || marca.isotipoUrl) as string}
                alt={marca.nombre}
                fill
                sizes="64px"
                className="object-contain p-1.5"
              />
            </span>
          ) : null}
          <div>
            <h1 className="text-lg font-semibold">Escuela {marca.nombre}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {paso === "email"
                ? "Escribe tu correo y te mandamos un código para entrar."
                : `Hemos enviado un código a ${email}.`}
            </p>
          </div>
        </div>

        {paso === "email" ? (
          <form onSubmit={enviarCorreo} className="mt-6 space-y-3">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              disabled={cargando}
              className="w-full"
              style={{ background: "var(--marca-primario)", color: "var(--marca-texto)" }}
            >
              {cargando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Enviarme el código
            </Button>
          </form>
        ) : (
          <form onSubmit={entrar} className="mt-6 space-y-3">
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.5em]"
              required
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              disabled={cargando || codigo.length !== 6}
              className="w-full"
              style={{ background: "var(--marca-primario)", color: "var(--marca-texto)" }}
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
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Usar otro correo
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
