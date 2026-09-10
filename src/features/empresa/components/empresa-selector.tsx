"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { useEmpresa, type Empresa } from "@/features/empresa/contexts/empresa-context";
import { useAuth } from "@/features/auth/contexts/auth-context";
import { resolveDestinoCambioEmpresa } from "@/features/layout/data/nav-routes";
import { getCatalogoEmpresaAction } from "@/features/empresa/actions/catalogo-actions";
import { moduloDisponibleEnEmpresa, type CatalogoEmpresa } from "@/features/auth/lib/permisos";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function EmpresaAvatar({ empresa, logoUrl, size = "md" }: { empresa: Empresa; logoUrl?: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-[11px]";
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={empresa.nombre}
        className={`${cls} rounded-md object-contain shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${cls} rounded-md flex items-center justify-center font-bold text-white shrink-0`}
      style={{ backgroundColor: empresa.color }}
    >
      {empresa.iniciales}
    </div>
  );
}

export function EmpresaSelector() {
  // Avatar pequeño = ISOTIPO (icono sin texto). Si no hay isotipo, iniciales (nunca el logo con texto).
  //
  // OJO: el isotipo se pinta con `empresaVisible`, NO con `empresaActual`. La
  // empresa "actual" cambia en cuanto se pulsa, pero la pantalla (menú de
  // módulos y contenido) sigue siendo de la anterior hasta que responde el
  // servidor. Pintando aquí la elegida, durante ese rato el logotipo decía
  // BALLES mientras el menú seguía enseñando los módulos de HABANA o BACANAL.
  const { empresas, empresaVisible, setEmpresaId, getIsotipoUrl } = useEmpresa();
  const { puedeVer, permisosLoaded } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Al cambiar de empresa: seguir en el mismo submódulo si el usuario tiene
  // acceso a él en la nueva empresa; si no, llevarle a "Mis Departamentos"
  // para que elija entre los disponibles. La decisión se calcula con la ruta
  // actual + permisos del usuario (misma lógica que el sidebar).
  const cambiarEmpresa = async (id: string) => {
    setOpen(false);

    // Catálogo de la empresa de DESTINO: hace falta para no dejar al usuario en
    // un módulo que allí no existe (SALA en una empresa que no es restaurante).
    // El contexto del navegador todavía tiene el catálogo de la empresa actual,
    // así que se pregunta al servidor. Si no llega, seguimos decidiendo solo con
    // los permisos: es como se comportaba antes y nunca deja a nadie tirado.
    const destinoEmpresa = empresas.find((e) => e.id === id);
    let catalogo: CatalogoEmpresa | null = null;
    try {
      if (destinoEmpresa?.dbId) {
        catalogo = await getCatalogoEmpresaAction(destinoEmpresa.dbId);
      }
    } catch {
      // Averiguar el catálogo es una MEJORA del destino, nunca un requisito:
      // si falla, se cambia igual de empresa con el criterio de siempre. Antes
      // esta llamada iba sin red y un fallo suyo dejaba el selector muerto.
      catalogo = null;
    }

    // Solo decidimos el destino si los permisos están CARGADOS. Con los
    // permisos a medias `puedeVer()` devuelve false para todo — no porque
    // falte el permiso, sino porque aún no ha llegado — y el usuario acababa
    // expulsado del submódulo en el que estaba. Sin veredicto fiable pasamos
    // `null`: se queda donde está y solo se refrescan los datos.
    const destino = permisosLoaded
      ? resolveDestinoCambioEmpresa(
          pathname,
          (modulo) =>
            (catalogo ? moduloDisponibleEnEmpresa(modulo, catalogo) : true) &&
            puedeVer(modulo),
        )
      : null;
    setEmpresaId(id, destino);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          className="flex items-center justify-center rounded-lg p-0.5 hover:bg-sidebar-accent/50 transition-colors focus:outline-none"
          title={empresaVisible.nombre}
        >
          <EmpresaAvatar empresa={empresaVisible} logoUrl={getIsotipoUrl(empresaVisible.id)} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        onMouseLeave={() => setOpen(false)}
      >
        <DropdownMenuLabel className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
          Cambiar empresa
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {empresas.map((e) => (
          <DropdownMenuItem
            key={e.id}
            onSelect={() => void cambiarEmpresa(e.id)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <EmpresaAvatar empresa={e} logoUrl={getIsotipoUrl(e.id)} size="sm" />
            <span className="text-sm font-medium flex-1 truncate">{e.nombre}</span>
            {e.id === empresaVisible.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
