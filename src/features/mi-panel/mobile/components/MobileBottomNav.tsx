"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare2, MessageCircle, Phone, Fingerprint } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { useEmpresa } from "@/features/empresa/contexts/empresa-context";
import { CamarasDrawer } from "@/features/camaras/components/CamarasDrawer";
import { AccesosDrawer } from "@/features/layout/components/AccesosDrawers";
import { HERRAMIENTA } from "@/features/layout/data/herramientas";
import { FicharSheet } from "./FicharSheet";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

// Fichar va en el CENTRO y destacado a propósito: es lo que más veces al día
// hace un empleado, y hasta ahora la única forma de fichar era cazar el aviso
// automático en su ventana de ±15 min. Si se te pasaba, no había manera de
// fichar desde ningún sitio (nadie enlazaba a /m/fichar).
const INICIO: NavItem = { href: "/m", label: "Inicio", icon: Home };
const LLAMAR: NavItem = { href: "/m/llamar", label: "Llamar", icon: Phone };
const TAREAS: NavItem = { href: "/m/tareas", label: "Tareas", icon: CheckSquare2, primary: true };
const CHAT: NavItem = { href: "/m/comunicacion", label: "Chat", icon: MessageCircle };

export function MobileBottomNav() {
  const pathname = usePathname() ?? "/m";
  const [ficharAbierto, setFicharAbierto] = useState(false);
  const { puedeVer } = useAuth();
  const { empresaActual } = useEmpresa();

  // Las cámaras y las claves del local son cosa de MANDO: solo las ve
  // quien tiene GERENCIA o DIRECCIÓN entre los departamentos de su rol (Iván,
  // 12-sep). El resto de la plantilla sigue con la barra de siempre.
  //
  // Además se respeta el interruptor de cada herramienta en Ajustes → Roles,
  // igual que en el ordenador: una herramienta apagada no sale para nadie, ni
  // para dirección.
  const esMando = puedeVer("GERENCIA") || puedeVer("DIRECCIÓN");
  const verCamaras = esMando && puedeVer("CÁMARAS");
  const verClaves = esMando && puedeVer("HERR_ACCESOS");

  // Con las dos herramientas la barra pasa de cinco huecos a siete: los rótulos
  // se encogen un punto para que ninguno se corte.
  const columnas = 5 + (verCamaras ? 1 : 0) + (verClaves ? 1 : 0);
  const apretado = columnas > 5;

  const entrada = (item: NavItem) => {
    const Icon = item.icon;
    const active =
      item.href === "/m" ? pathname === "/m" : pathname.startsWith(item.href);
    return (
      <li key={item.href} className="flex-1">
        <Link
          href={item.href}
          prefetch={false}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 font-medium leading-tight transition-colors",
            apretado ? "text-[9px]" : "text-[10px]",
            active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon
            className={cn("h-5 w-5", item.primary && active && "h-6 w-6")}
            strokeWidth={active ? 2.4 : 2}
          />
          <span className="w-full truncate text-center">{item.label}</span>
        </Link>
      </li>
    );
  };

  // Una herramienta de la barra: no navega, abre su panel encima. Mismo icono y
  // mismo nombre que en el ordenador (catálogo único de herramientas).
  const herramienta = (
    clave: "camaras" | "accesos",
    etiqueta: string,
    envoltura: (trigger: ReactNode) => ReactNode,
  ) => {
    const Icon = HERRAMIENTA[clave].Icon;
    return (
      <li key={clave} className="flex-1">
        {envoltura(
          <button
            type="button"
            aria-label={HERRAMIENTA[clave].nombre}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-0.5 px-0.5 py-2.5 font-medium leading-tight text-muted-foreground transition-colors active:text-foreground",
              apretado ? "text-[9px]" : "text-[10px]",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
            <span className="w-full truncate text-center">{etiqueta}</span>
          </button>,
        )}
      </li>
    );
  };

  return (
    <nav
      aria-label="Navegación principal"
      // `fixed bottom-0` se ancla al documento, y en iOS Safari la barra se despega
      // al hacer scroll (cuando aparece/desaparece la barra del navegador). Con
      // `position: sticky` sobre el contenedor a altura de pantalla completa, la
      // barra queda pegada abajo SIEMPRE, sin saltos. La altura se publica en
      // --nav-h para que cada pantalla reserve exactamente ese hueco.
      style={{ height: "var(--nav-h)" }}
      className="sticky bottom-0 z-50 mt-auto w-full shrink-0 border-t border-border/60 bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-screen-sm items-stretch justify-around">
        {entrada(INICIO)}
        {verCamaras &&
          herramienta("camaras", "Cámaras", (trigger) => (
            <CamarasDrawer>{trigger}</CamarasDrawer>
          ))}
        {entrada(LLAMAR)}

        {/* FICHAR: no navega, abre la hoja de fichaje aquí mismo. El círculo
            sobresale de la barra (margen negativo); el layout recorta solo en
            horizontal (`overflow-x-clip`), así que el saliente se ve. */}
        <li className="flex-1">
          <button
            type="button"
            onClick={() => setFicharAbierto(true)}
            aria-label="Fichar"
            className="flex h-full w-full flex-col items-center justify-start"
          >
            <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-colors active:bg-emerald-600">
              <Fingerprint className="h-7 w-7" strokeWidth={2.2} />
            </span>
            <span
              className={cn(
                "mt-0.5 w-full truncate text-center font-medium leading-tight text-muted-foreground",
                apretado ? "text-[9px]" : "text-[10px]",
              )}
            >
              Fichar
            </span>
          </button>
        </li>

        {entrada(TAREAS)}
        {verClaves &&
          herramienta("accesos", "Claves", (trigger) => (
            <AccesosDrawer empresaSlug={empresaActual.id}>{trigger}</AccesosDrawer>
          ))}
        {entrada(CHAT)}
      </ul>

      <FicharSheet abierto={ficharAbierto} onCerrar={() => setFicharAbierto(false)} />
    </nav>
  );
}
