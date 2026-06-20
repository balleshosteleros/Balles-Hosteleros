"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Building2 } from "lucide-react";
import { setEmpresaActiva } from "@/features/empresa/actions/empresa-activa-actions";
import type { InicioEmpresa } from "../lib/mobile-inicio-data";

/** Iniciales del nombre de la persona para el avatar de respaldo. */
function inicialesNombre(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const a = partes[0]?.[0] ?? "";
  const b = partes[1]?.[0] ?? "";
  return (a + b).toUpperCase() || "·";
}

/** Iniciales de respaldo cuando la empresa no tiene isotipo/logo. */
function inicialesEmpresa(nombre: string): string {
  return nombre.slice(0, 2).toUpperCase();
}

interface Props {
  nombre: string;
  rolLabel: string | null;
  avatarUrl: string | null;
  empresaActual: InicioEmpresa | null;
  empresas: InicioEmpresa[];
}

/**
 * Pill de perfil del Inicio móvil (mismo formato que el de ordenador):
 * logo de empresa (sirve para cambiar de empresa) · nombre + rol · foto.
 */
export function PerfilPill({
  nombre,
  rolLabel,
  avatarUrl,
  empresaActual,
  empresas,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);

  // Con una sola empresa el logo no es interactivo (no hay nada que elegir).
  const soloUna = empresas.length <= 1;
  const actual = empresaActual ?? empresas[0] ?? null;
  const logo = actual?.isotipoUrl ?? actual?.logoUrl ?? null;

  const elegir = async (id: string) => {
    if (id === actual?.id) {
      setOpen(false);
      return;
    }
    setCambiando(id);
    const res = await setEmpresaActiva(id);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
    setCambiando(null);
  };

  return (
    <div className="relative min-w-0">
      <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card py-1 pl-1 pr-1.5 shadow-sm">
        {/* Logo de empresa → cambiar de empresa */}
        <button
          type="button"
          onClick={() => !soloUna && setOpen((v) => !v)}
          disabled={soloUna}
          aria-label={soloUna ? actual?.nombre : "Cambiar de empresa"}
          className="flex items-center gap-0.5 rounded-full active:opacity-70 disabled:opacity-100"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full"
            style={{ backgroundColor: actual?.color ?? "hsl(220 70% 45%)" }}
          >
            {logo ? (
              <Image
                src={logo}
                alt={actual?.nombre ?? ""}
                width={32}
                height={32}
                className="h-8 w-8 object-cover"
                unoptimized
              />
            ) : actual ? (
              <span className="text-[10px] font-bold text-white">
                {inicialesEmpresa(actual.nombre)}
              </span>
            ) : (
              <Building2 className="h-4 w-4 text-white" />
            )}
          </span>
          {!soloUna && (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
        </button>

        <div className="mx-0.5 h-6 w-px shrink-0 bg-border" />

        {/* Nombre + rol */}
        <div className="flex min-w-0 max-w-[150px] flex-col justify-center px-0.5">
          <span
            className="truncate text-sm font-semibold leading-tight text-foreground"
            title={nombre}
          >
            {nombre}
          </span>
          {rolLabel && (
            <span className="truncate text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
              {rolLabel}
            </span>
          )}
        </div>

        {/* Foto del trabajador */}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-border">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={nombre}
              width={36}
              height={36}
              className="h-9 w-9 object-cover"
              unoptimized
            />
          ) : (
            <span className="text-xs font-bold text-primary">
              {inicialesNombre(nombre)}
            </span>
          )}
        </span>
      </div>

      {/* Desplegable para cambiar de empresa */}
      {open && !soloUna && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-xl">
            <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cambiar de empresa
            </p>
            <ul className="pb-1.5">
              {empresas.map((e) => {
                const eLogo = e.isotipoUrl ?? e.logoUrl ?? null;
                const activa = e.id === actual?.id;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => elegir(e.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm active:bg-muted"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full"
                        style={{ backgroundColor: e.color ?? "hsl(220 70% 45%)" }}
                      >
                        {eLogo ? (
                          <Image
                            src={eLogo}
                            alt={e.nombre}
                            width={28}
                            height={28}
                            className="h-7 w-7 object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-white">
                            {inicialesEmpresa(e.nombre)}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 truncate font-medium">
                        {e.nombre}
                      </span>
                      {cambiando === e.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        activa && <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
