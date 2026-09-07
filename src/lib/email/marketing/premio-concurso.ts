/**
 * El correo que recibe quien gana el concurso del mes.
 *
 * Se manda aunque el código ya se le haya enseñado en pantalla: el que juega
 * desde el móvil en la calle cierra la pestaña y a los dos días no se acuerda ni
 * del código ni de dónde lo vio. El correo es lo que le queda.
 *
 * Va por el mismo camino que los correos de reserva —`sendEmail` con la marca de
 * la empresa—, no por la API de campañas: es un correo para una persona, no un
 * envío masivo, y además no es publicidad, así que no lleva enlace de baja.
 */
import "server-only";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { envolverEmail, tarjetaCodigo, escapeHtml, type MarcaEmpresa } from "@/lib/email/reservas/estilo";

export async function enviarCorreoPremio(input: {
  empresaId: string;
  email: string;
  nombre?: string | null;
  premio: string;
  codigo: string;
  posicion: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("empresas")
    .select("nombre, logo_url, isotipo_url, color, color_secundario")
    .eq("id", input.empresaId)
    .maybeSingle();
  if (!data) return;

  const empresa: MarcaEmpresa = {
    nombre: (data.nombre as string) ?? "",
    logo_url: (data.logo_url as string | null) ?? null,
    isotipo_url: (data.isotipo_url as string | null) ?? null,
    color: (data.color as string | null) ?? null,
    color_secundario: (data.color_secundario as string | null) ?? null,
  };

  const saludo = input.nombre?.trim() ? `${input.nombre.trim().split(" ")[0]}, has ganado` : "Has ganado";

  const contenido = `
    <p style="margin:0 0 12px 0;font-size:16px;line-height:1.6;color:#0f172a;">
      Has acertado las cinco y has entrado en el puesto ${input.posicion} de los tres. ${escapeHtml(
        input.premio.charAt(0).toUpperCase() + input.premio.slice(1),
      )} corre de nuestra cuenta.
    </p>
    ${tarjetaCodigo(input.codigo, empresa.color)}
    <p style="margin:16px 0 0 0;font-size:14px;line-height:1.6;color:#475569;">
      Reserva mesa cuando quieras y enséñanos este código al llegar. Si prefieres, dilo al
      reservar por teléfono y lo dejamos anotado.
    </p>`;

  await sendEmail({
    to: input.email,
    subject: `${saludo.replace(",", "")} — enséñanos este código`,
    html: envolverEmail({
      empresa,
      badge: `Puesto ${input.posicion} de 3`,
      titular: saludo,
      subtitulo: "Concurso del mes",
      contenido,
      pie: "Nos vemos pronto.",
    }),
    empresaId: input.empresaId,
    // El correo ya trae su propia cabecera de marca dentro de `envolverEmail`.
    brandHeader: false,
  });
}
