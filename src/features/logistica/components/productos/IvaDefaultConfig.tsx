"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listIvas } from "@/features/logistica/actions/catalogos-estandar-actions";
import { getDefaultIva, saveDefaultIva } from "@/features/logistica/actions/config-actions";
import { pickDefaultIva } from "@/features/logistica/data/productos";

// IVA por defecto a nivel empresa (compra / venta). Vive en
// Ajustes → Departamentos → Logística → Productos. Autoguarda al cambiar.
// Los IVAs son INDEPENDIENTES por tipo, así que cada select lee los suyos.

function IvaDefaultSelect({ tipo }: { tipo: "compra" | "venta" }) {
  const [ivas, setIvas] = useState<string[]>([]);
  const [valor, setValor] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listIvas(tipo), getDefaultIva(tipo)]).then(([ivaRes, def]) => {
      if (cancelled) return;
      setIvas(ivaRes.ok ? ivaRes.data.map((i) => i.codigo) : []);
      setValor(def ?? "");
      setCargando(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tipo]);

  const handleChange = async (v: string) => {
    const previo = valor;
    setValor(v);
    setGuardando(true);
    const res = await saveDefaultIva(tipo, v);
    setGuardando(false);
    if (res.ok) {
      toast.success("IVA por defecto guardado");
    } else {
      setValor(previo);
      toast.error(res.error ?? "No se pudo guardar el IVA por defecto");
    }
  };

  // Si la empresa aún no lo configuró, mostramos el IVA efectivo (el que ya se
  // aplica por fallback) para que el selector nunca aparezca vacío.
  const valorMostrado = valor || (cargando ? "" : pickDefaultIva(ivas));

  return (
    <div>
      <label className="text-xs font-medium capitalize">{tipo}</label>
      <Select
        value={valorMostrado || undefined}
        onValueChange={handleChange}
        disabled={cargando || guardando || ivas.length === 0}
      >
        <SelectTrigger className="mt-1">
          <SelectValue placeholder={cargando ? "Cargando…" : "Seleccionar IVA"} />
        </SelectTrigger>
        <SelectContent>
          {ivas.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function IvaDefaultConfig() {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        IVA por defecto
      </p>
      <div className="rounded-md border bg-card p-2.5 space-y-3">
        <p className="text-xs leading-snug text-muted-foreground">
          Tipo de IVA que se preselecciona automáticamente al crear un producto y al
          añadir precios. Siempre se puede cambiar en cada producto. Los productos de
          compra nunca pueden quedar sin IVA.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <IvaDefaultSelect tipo="compra" />
          <IvaDefaultSelect tipo="venta" />
        </div>
      </div>
    </div>
  );
}
