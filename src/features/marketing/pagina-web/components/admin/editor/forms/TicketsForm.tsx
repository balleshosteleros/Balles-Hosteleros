"use client";

import { Input } from "@/components/ui/input";
import { useEditorStore } from "../../../../hooks/useEditorStore";
import { Field, Section } from "./shared";
import type { Bloque, TicketsDatos } from "../../../../types";

/**
 * Ajustes del bloque de Tickets en la web.
 *
 * Solo el título y el subtítulo: los productos, sus precios y su stock se
 * configuran en Sala → Reservas → Tickets, que es su sitio. Duplicar aquí esa
 * configuración obligaría a mantener los precios en dos lados.
 */
export function TicketsForm({ bloque }: { bloque: Extract<Bloque, { tipo: "tickets" }> }) {
  const actualizar = useEditorStore((s) => s.actualizarBloque);
  const datos = bloque.datos;
  const set = (patch: Partial<TicketsDatos>) => actualizar<typeof bloque>(bloque.id, patch);

  return (
    <div className="space-y-5">
      <Section title="Textos">
        <Field label="Título">
          <Input
            value={datos.titulo ?? ""}
            onChange={(e) => set({ titulo: e.target.value })}
            placeholder="Nuestras experiencias"
          />
        </Field>
        <Field label="Subtítulo">
          <Input
            value={datos.subtitulo ?? ""}
            onChange={(e) => set({ subtitulo: e.target.value })}
            placeholder="Cómpralas ahora y reserva tu día cuando quieras."
          />
        </Field>
      </Section>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Se muestran todas las experiencias activas y a la venta. Se crean y se
        editan en Sala → Reservas → Tickets: precio, aforo y condiciones de
        canje. Lo que se compre aquí queda pagado, y el cliente recibe su código
        por correo para reservar el día que quiera.
      </p>
    </div>
  );
}
