"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useEmpresa, type Empresa } from "@/features/empresa/contexts/empresa-context";
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
  const { empresas, empresaActual, setEmpresaId, getLogoUrl } = useEmpresa();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onMouseEnter={() => setOpen(true)}
          className="flex items-center justify-center rounded-lg p-0.5 hover:bg-sidebar-accent/50 transition-colors focus:outline-none"
          title={empresaActual.nombre}
        >
          <EmpresaAvatar empresa={empresaActual} logoUrl={getLogoUrl(empresaActual.id)} />
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
            onSelect={() => { setEmpresaId(e.id); setOpen(false); }}
            className="flex items-center gap-2 cursor-pointer"
          >
            <EmpresaAvatar empresa={e} logoUrl={getLogoUrl(e.id)} size="sm" />
            <span className="text-sm font-medium flex-1 truncate">{e.nombre}</span>
            {e.id === empresaActual.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
