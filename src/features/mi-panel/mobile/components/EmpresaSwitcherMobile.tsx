"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Building2 } from "lucide-react";
import { setEmpresaActiva } from "@/features/empresa/actions/empresa-activa-actions";
import type { InicioEmpresa } from "../lib/mobile-identidad-data";

/** Iniciales de respaldo cuando la empresa no tiene isotipo/logo. */
function inicialesEmpresa(nombre: string): string {
  return nombre.slice(0, 2).toUpperCase();
}

interface Props {
  empresaActual: InicioEmpresa | null;
  empresas: InicioEmpresa[];
  /** Tamaño del logo: la cabecera de las pantallas internas es más compacta. */
  size?: "sm" | "md";
}

/**
 * Icono de empresa que abre el cambio de empresa.
 *
 * REGLA (Iván, 28-ago): este icono va SIEMPRE al lado del icono del empleado,
 * en el Inicio y dentro de cualquier módulo o submódulo. Nunca puede
 * desaparecer, porque es la única forma de cambiar de empresa desde el móvil.
 */
export function EmpresaSwitcherMobile({ empresaActual, empresas, size = "md" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);

  // Con una sola empresa el logo no es interactivo (no hay nada que elegir),
  // pero SIGUE VIÉNDOSE: identifica en qué empresa estás.
  const soloUna = empresas.length <= 1;
  const actual = empresaActual ?? empresas[0] ?? null;
  const logo = actual?.isotipoUrl ?? actual?.logoUrl ?? null;
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const px = size === "sm" ? 28 : 32;

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
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => !soloUna && setOpen((v) => !v)}
        disabled={soloUna}
        aria-label={soloUna ? (actual?.nombre ?? "Empresa") : "Cambiar de empresa"}
        className="flex items-center gap-0.5 rounded-full active:opacity-70 disabled:opacity-100"
      >
        {logo ? (
          // Isotipo suelto, exactamente como en el software de ordenador
          // (`EmpresaSelector`): sin recuadro ni borde propios. Lo que lo hace
          // visible es el fondo `bg-muted/40` del pill que lo envuelve — sobre
          // blanco puro, un isotipo de trazo fino como el de BACANAL se pierde.
          <Image
            src={logo}
            alt={actual?.nombre ?? ""}
            width={px}
            height={px}
            className={`${box} shrink-0 rounded-md object-contain`}
            unoptimized
          />
        ) : (
          <span
            className={`${box} flex shrink-0 items-center justify-center overflow-hidden rounded-md`}
            style={{ backgroundColor: actual?.color ?? "hsl(220 70% 45%)" }}
          >
            {actual ? (
              <span className="text-[10px] font-bold text-white">
                {inicialesEmpresa(actual.nombre)}
              </span>
            ) : (
              <Building2 className="h-4 w-4 text-white" />
            )}
          </span>
        )}
        {!soloUna && (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Desplegable para cambiar de empresa */}
      {open && !soloUna && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-2xl border border-border/60 bg-popover shadow-xl">
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
                      {eLogo ? (
                        <Image
                          src={eLogo}
                          alt={e.nombre}
                          width={28}
                          height={28}
                          className="h-7 w-7 shrink-0 rounded-md object-contain"
                          unoptimized
                        />
                      ) : (
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md"
                          style={{ backgroundColor: e.color ?? "hsl(220 70% 45%)" }}
                        >
                          <span className="text-[10px] font-bold text-white">
                            {inicialesEmpresa(e.nombre)}
                          </span>
                        </span>
                      )}
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
