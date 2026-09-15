import "server-only";

/**
 * Todo lo que hace falta para escribirle a quien reservó, en una sola consulta.
 *
 * Lo usan el correo de confirmación y el de anulación, y tienen que decir
 * exactamente lo mismo: la misma marca, la misma hora y el mismo nombre. Con
 * dos consultas separadas se acababan contando cosas distintas.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { zonaHorariaDeConfig } from "@/features/empresa/lib/empresa-server";
import { formatFechaEnZona, formatHoraEnZona } from "@/features/empresa/lib/zona-horaria";
import type { MarcaEmpresa } from "@/lib/email/reservas/estilo";

/** "Europe/Madrid" → "Madrid". Lo que se le enseña a quien reserva. */
export function ciudadDeZona(tz: string): string {
  const trozo = tz.split("/").pop() ?? tz;
  return trozo.replace(/_/g, " ");
}

export interface DatosCitaCorreo {
  empresaId: string;
  marca: MarcaEmpresa & { telefono?: string | null };
  zona: string;
  calendario: string;
  duracionMin: number;
  inicioISO: string;
  finISO: string;
  fechaLarga: string;
  hora: string;
  nombreCliente: string;
  emailCliente: string | null;
  conQuien: string | null;
  meetUrl: string | null;
  tokenGestion: string | null;
  tituloEvento: string;
}

export async function datosCitaParaCorreo(citaId: string): Promise<DatosCitaCorreo | null> {
  const admin = createAdminClient();

  const { data: filaCita } = await admin
    .from("citas")
    .select(
      `id, empresa_id, inicio, fin, google_meet_url, token_gestion,
       citas_calendarios(nombre, duracion_min),
       clientes_sala(nombre, apellidos, email),
       empleados(nombre, apellidos)`,
    )
    .eq("id", citaId)
    .maybeSingle();
  if (!filaCita) return null;
  const cita = filaCita as Record<string, unknown>;

  const empresaId = cita.empresa_id as string;
  const { data: empresa } = await admin
    .from("empresas")
    .select(
      "nombre, logo_url, isotipo_url, logo_alt_url, color, color_secundario, datos_generales, config_operativa",
    )
    .eq("id", empresaId)
    .maybeSingle();

  const zona = zonaHorariaDeConfig((empresa as { config_operativa?: unknown } | null)?.config_operativa);
  const generales = (empresa as { datos_generales?: Record<string, unknown> } | null)?.datos_generales;

  // El nombre que ve el CLIENTE es el nombre comercial (Ajustes → Empresa), no
  // el rótulo corto con el que la empresa aparece por dentro del software:
  // dentro es BALLES, y de cara a fuera BALLES HOSTELEROS.
  const nombreComercial =
    typeof generales?.nombreComercial === "string" ? generales.nombreComercial.trim() : "";
  const nombreEmpresa =
    nombreComercial || ((empresa as { nombre?: string | null } | null)?.nombre ?? "").trim();

  const cliente = cita.clientes_sala as
    | { nombre?: string | null; apellidos?: string | null; email?: string | null }
    | null;
  const cal = cita.citas_calendarios as { nombre?: string | null; duracion_min?: number | null } | null;
  const empleado = cita.empleados as { nombre?: string | null; apellidos?: string | null } | null;

  const inicioISO = cita.inicio as string;
  const finISO = cita.fin as string;
  const calendario = cal?.nombre?.trim() || "Cita";

  return {
    empresaId,
    marca: {
      nombre: nombreEmpresa,
      logo_url: (empresa as { logo_url?: string | null } | null)?.logo_url ?? null,
      isotipo_url: (empresa as { isotipo_url?: string | null } | null)?.isotipo_url ?? null,
      logo_alt_url: (empresa as { logo_alt_url?: string | null } | null)?.logo_alt_url ?? null,
      color: (empresa as { color?: string | null } | null)?.color ?? null,
      color_secundario: (empresa as { color_secundario?: string | null } | null)?.color_secundario ?? null,
      telefono: typeof generales?.telefonoPrincipal === "string" ? generales.telefonoPrincipal : null,
    },
    zona,
    calendario,
    duracionMin:
      cal?.duracion_min ??
      Math.round((new Date(finISO).getTime() - new Date(inicioISO).getTime()) / 60_000),
    inicioISO,
    finISO,
    fechaLarga: formatFechaEnZona(inicioISO, zona, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    hora: formatHoraEnZona(inicioISO, zona),
    nombreCliente: [cliente?.nombre, cliente?.apellidos].filter(Boolean).join(" ").trim(),
    emailCliente: cliente?.email?.trim() || null,
    conQuien: [empleado?.nombre, empleado?.apellidos].filter(Boolean).join(" ").trim() || null,
    meetUrl: (cita.google_meet_url as string | null) ?? null,
    tokenGestion: (cita.token_gestion as string | null) ?? null,
    tituloEvento: nombreEmpresa ? `${calendario} · ${nombreEmpresa}` : calendario,
  };
}
