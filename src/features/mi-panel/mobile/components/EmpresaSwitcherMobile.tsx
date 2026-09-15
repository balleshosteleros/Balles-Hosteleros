"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, Building2 } from "lucide-react";
import { setEmpresaActiva } from "@/features/empresa/actions/empresa-activa-actions";
import { setEmpresaActivaCliente } from "@/lib/supabase/empresa-activa-cliente";
import { limpiarCacheAuthLocal } from "@/features/auth/contexts/auth-context";
import type { InicioEmpresa } from "../lib/mobile-identidad-data";

/** Iniciales de respaldo cuando la empresa no tiene isotipo/logo. */
function inicialesEmpresa(nombre: string): string {
  return nombre.slice(0, 2).toUpperCase();
}

/**
 * A qué pantalla se vuelve tras cambiar de empresa.
 *
 * Se sigue en la MISMA pantalla (si estabas en Fichajes, sigues en Fichajes),
 * salvo que estuvieras dentro de una FICHA concreta —un departamento, un
 * pedido—: esa ficha es de la empresa anterior y en la nueva no existe, así
 * que se sube al listado del que colgaba.
 */
function destinoTrasCambio(pathname: string | null): string {
  if (!pathname || !pathname.startsWith("/m")) return "/m";
  const partes = pathname.split("/").filter(Boolean);
  if (partes.length <= 2) return `/${partes.join("/")}`;
  return `/${partes[0]}/${partes[1]}`;
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);

  // Con una sola empresa el logo no es interactivo (no hay nada que elegir),
  // pero SIGUE VIÉNDOSE: identifica en qué empresa estás.
  const soloUna = empresas.length <= 1;
  const actual = empresaActual ?? empresas[0] ?? null;
  const logo = actual?.isotipoUrl ?? actual?.logoUrl ?? null;
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const px = size === "sm" ? 28 : 32;

  /**
   * CAMBIAR DE EMPRESA EN EL MÓVIL: NO QUEDA NADA DE LA ANTERIOR
   * ===========================================================
   * Antes esto era `setEmpresaActiva()` + `router.refresh()`, y con eso NO se
   * cambiaba de empresa de verdad (Iván, 15-sep): el rótulo de arriba pasaba a
   * la nueva, pero el chat seguía abriendo los grupos de HABANA. Pasaban dos
   * cosas a la vez:
   *
   *   · La empresa que el navegador manda en cada consulta (`x-bh-empresa`,
   *     la copia de `empresa-activa-cliente`) se quedaba en la ANTERIOR. La
   *     cookie del servidor sí cambiaba, pero las consultas del teléfono
   *     seguían pidiendo —y la base de datos autorizando— la empresa vieja.
   *   · `router.refresh()` solo vuelve a pintar lo que calcula el servidor.
   *     Las pantallas del teléfono cargan sus datos ellas mismas al montarse,
   *     así que se quedaban tal cual estaban, con lo ya cargado de la empresa
   *     anterior.
   *
   * Ahora se hace lo que pidió Iván: TODO desaparece y entra todo de la nueva.
   * Primero se cambia la empresa del navegador, luego la del servidor, se
   * tiran los permisos guardados (son los de la empresa anterior: decidían qué
   * módulos se ven) y se RECARGA la pantalla entera. Una recarga completa es
   * lo único que garantiza que no sobrevive ni un dato de la otra empresa.
   */
  const elegir = async (id: string) => {
    if (id === actual?.id) {
      setOpen(false);
      return;
    }
    setCambiando(id);
    // La empresa del navegador, ANTES de nada: es la que viaja en cada
    // consulta. Si fallara el cambio, se devuelve a la que estaba.
    setEmpresaActivaCliente(id);

    let res: Awaited<ReturnType<typeof setEmpresaActiva>>;
    try {
      res = await setEmpresaActiva(id);
    } catch (err) {
      console.error("[movil] cambiar de empresa:", err);
      res = { ok: false };
    }

    if (!res.ok) {
      setEmpresaActivaCliente(actual?.id ?? null);
      setCambiando(null);
      if (res.motivo === "sesion_caducada") {
        toast.error("Tu sesión ha caducado. Te llevo a entrar de nuevo…", { duration: 3000 });
        window.setTimeout(() => { window.location.href = "/salir"; }, 1800);
        return;
      }
      toast.error(
        res.motivo === "sin_acceso"
          ? "No tienes acceso a esa empresa."
          : "No se pudo cambiar de empresa. Inténtalo de nuevo.",
      );
      return;
    }

    setOpen(false);
    // Los permisos guardados en el teléfono son los de la empresa anterior:
    // si no se tiran, la pantalla de inicio pinta por un momento los módulos
    // de la otra empresa.
    limpiarCacheAuthLocal();
    // `replace` y no `assign`: la pantalla de la empresa anterior no debe
    // quedarse en el historial, porque el botón de atrás la devolvería con
    // sus datos ya caducados.
    window.location.replace(destinoTrasCambio(pathname));
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
            className={`${box} shrink-0 rounded-full object-cover`}
            unoptimized
          />
        ) : (
          <span
            className={`${box} flex shrink-0 items-center justify-center overflow-hidden rounded-full`}
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
                          className="h-7 w-7 shrink-0 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full"
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
