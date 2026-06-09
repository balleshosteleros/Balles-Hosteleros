"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Building2 } from "lucide-react";
import { setEmpresaActiva } from "@/features/empresa/actions/empresa-activa-actions";
import type { InicioEmpresa } from "../lib/mobile-inicio-data";

interface Props {
  empresaActual: InicioEmpresa | null;
  empresas: InicioEmpresa[];
}

/** Iniciales de respaldo cuando la empresa no tiene isotipo/logo. */
function iniciales(nombre: string): string {
  return nombre.slice(0, 2).toUpperCase();
}

export function EmpresaSwitcherMobile({ empresaActual, empresas }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);

  // Con una sola empresa no hay nada que elegir: solo se muestra el logo.
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
    <div className="relative">
      <button
        type="button"
        onClick={() => !soloUna && setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-2.5 backdrop-blur active:opacity-70 disabled:opacity-100"
        disabled={soloUna}
        aria-label={soloUna ? actual?.nombre : "Cambiar de empresa"}
      >
        <span
          className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundColor: actual?.color ?? "hsl(220 70% 45%)" }}
        >
          {logo ? (
            <Image
              src={logo}
              alt={actual?.nombre ?? ""}
              width={28}
              height={28}
              className="h-7 w-7 object-cover"
              unoptimized
            />
          ) : (
            <span className="text-[10px] font-bold text-white">
              {actual ? iniciales(actual.nombre) : <Building2 className="h-3.5 w-3.5 text-white" />}
            </span>
          )}
        </span>
        <span className="max-w-[120px] truncate text-xs font-semibold">
          {actual?.nombre ?? "Empresa"}
        </span>
        {!soloUna && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && !soloUna && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-xl">
            <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
                            {iniciales(e.nombre)}
                          </span>
                        )}
                      </span>
                      <span className="flex-1 truncate font-medium">{e.nombre}</span>
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
