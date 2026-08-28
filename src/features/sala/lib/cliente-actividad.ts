import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Registro de la actividad del CLIENTE (no de la reserva).
 *
 * Son dos historiales distintos y no deben mezclarse:
 *   · `reserva_historial` → lo que le pasa a UNA reserva (mesa, hora, estado…).
 *     Al abrir otra reserva del mismo cliente se ve la de esa otra reserva.
 *   · `cliente_historial` → lo que le pasa a la PERSONA (email, teléfono,
 *     nombre). Es una sola, se mire desde la reserva que se mire.
 *
 * Cambiar un email no le pasa a una reserva: le pasa al cliente. Por eso este
 * registro va aparte, y por eso se escribe una sola vez por cambio en lugar de
 * repetirlo en cada una de sus reservas.
 */

/** Los cuatro datos de contacto, tal y como se llaman en `clientes_sala`. */
export interface DatosContactoCliente {
  nombre: string | null;
  apellidos: string | null;
  email: string | null;
  telefono: string | null;
}

const CAMPOS: (keyof DatosContactoCliente)[] = [
  "nombre",
  "apellidos",
  "email",
  "telefono",
];

/** Vacío y NULL son lo mismo aquí: borrar algo que ya estaba vacío no es un cambio. */
function normalizar(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}

/**
 * Escribe una línea por cada dato de contacto que REALMENTE cambia.
 *
 * Nunca lanza: el dato ya está guardado cuando se llama a esto, y no tendría
 * sentido deshacer un cambio correcto porque falle su registro. Un fallo se
 * anota en el log y punto.
 */
export async function registrarCambioDatosCliente(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    clienteId: string;
    antes: DatosContactoCliente;
    despues: DatosContactoCliente;
    usuarioId: string | null;
    usuarioNombre: string | null;
    origen?: "MANUAL" | "AUTOMATICO" | "PORTAL_PUBLICO" | "GOOGLE_RWG";
  },
): Promise<void> {
  try {
    const filas = CAMPOS.map((campo) => ({
      campo,
      anterior: normalizar(params.antes[campo]),
      nuevo: normalizar(params.despues[campo]),
    }))
      .filter((c) => c.anterior !== c.nuevo)
      .map((c) => ({
        empresa_id: params.empresaId,
        cliente_id: params.clienteId,
        campo: c.campo,
        valor_anterior: c.anterior,
        valor_nuevo: c.nuevo,
        usuario_id: params.usuarioId,
        usuario_nombre: params.usuarioNombre,
        origen: params.origen ?? "MANUAL",
      }));
    if (filas.length === 0) return;

    const { error } = await supabase.from("cliente_historial").insert(filas);
    if (error) console.error("[clientes] actividad:", error.message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error("[clientes] actividad:", msg);
  }
}
