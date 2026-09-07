"use server";

import { z } from "zod";
import { participar, type ResultadoParticipacion } from "@/features/marketing/services/concurso";

/**
 * Entrada del formulario del concurso. Llega de internet abierta, así que se
 * valida entera: el correo tiene que ser un correo y las respuestas, números
 * dentro del rango de opciones que puede tener una pregunta.
 */
const esquema = z.object({
  empresaSlug: z.string().min(1).max(64),
  clave: z.string().min(1).max(64),
  email: z.string().email("Ese correo no parece válido").max(160),
  nombre: z.string().max(120).optional(),
  telefono: z.string().max(40).optional(),
  respuestas: z.record(z.string(), z.number().int().min(0).max(9)),
});

export async function participarAction(
  entrada: unknown,
): Promise<ResultadoParticipacion> {
  const parsed = esquema.safeParse(entrada);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos incorrectos" };
  }

  const respuestas: Record<number, number> = {};
  for (const [k, v] of Object.entries(parsed.data.respuestas)) {
    respuestas[Number(k)] = v;
  }

  return participar({ ...parsed.data, respuestas });
}
