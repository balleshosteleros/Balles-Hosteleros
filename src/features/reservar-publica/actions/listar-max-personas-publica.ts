"use server";

/**
 * Tope de personas por reserva que se le ofrece al cliente en el portal
 * público.
 *
 * El desplegable de personas no puede ofrecer números que el restaurante no
 * acepta: el máximo sale de Configuración → Reservas → Límites ("Tamaño máximo
 * por reserva", métrica `maxpax`), que es la misma regla que aplica el back
 * office. Así online e interno ofrecen exactamente el mismo rango.
 *
 * Como el cliente elige las personas ANTES que la fecha definitiva y el turno,
 * se devuelve el mayor `maxpax` vigente en el horizonte de reservas: ofrecer
 * menos escondería mesas que sí se pueden reservar otro día. La validación fina
 * por fecha/turno sigue haciéndose al enviar la reserva.
 */

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToRegla, type ReglaRow } from "@/features/sala/reglas/data/reglas";
import { resolverValorEfectivo } from "@/features/sala/reglas/lib/resolver";
import { MAX_COMENSALES_SIN_REGLA } from "@/features/sala/data/reservas";

const inputSchema = z.object({
  empresaSlug: z.string().min(1).max(120),
});

/** Días hacia delante que se exploran buscando el mayor `maxpax` vigente. */
const HORIZONTE_DIAS = 90;

export async function listarMaxPersonasPublicaAction(
  input: z.input<typeof inputSchema>,
): Promise<number> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return MAX_COMENSALES_SIN_REGLA;

  try {
    const admin = createAdminClient();

    const { data: empresa } = await admin
      .from("empresas")
      .select("id")
      .eq("slug", parsed.data.empresaSlug)
      .maybeSingle();
    if (!empresa) return MAX_COMENSALES_SIN_REGLA;

    const { data: rows } = await admin
      .from("empresa_reservas_reglas")
      .select("*")
      .eq("empresa_id", empresa.id as string)
      .eq("metrica", "maxpax")
      .eq("activo", true);

    const reglas = (rows ?? []).map((r) => rowToRegla(r as ReglaRow));
    if (reglas.length === 0) return MAX_COMENSALES_SIN_REGLA;

    // Mayor tope vigente en el horizonte: una regla puede aplicar solo a
    // ciertos días (fines de semana, fechas señaladas), y el cliente todavía no
    // ha fijado la fecha cuando elige cuántos son.
    let max = 0;
    const hoy = new Date();
    for (let i = 0; i <= HORIZONTE_DIAS; i++) {
      const d = new Date(hoy);
      d.setDate(d.getDate() + i);
      const fechaISO = d.toISOString().slice(0, 10);
      for (const turno of ["COMIDA", "CENA"] as const) {
        const v = resolverValorEfectivo(reglas, fechaISO, turno, "maxpax");
        if (v != null && v > max) max = v;
      }
    }

    return max > 0 ? max : MAX_COMENSALES_SIN_REGLA;
  } catch (err) {
    console.error("[reservar-publica] listarMaxPersonasPublicaAction:", err);
    return MAX_COMENSALES_SIN_REGLA;
  }
}
