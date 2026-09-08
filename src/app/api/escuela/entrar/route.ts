import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { alumnoDesdeUsuario } from "@/features/escuela/services/acceso-alumno";
import { crearSesionAlumno } from "@/features/escuela/lib/sesion-alumno";
import { registrarAcceso } from "@/features/escuela/services/portal-alumno";

/**
 * ENTRADA A LA ESCUELA DESDE DENTRO DEL SOFTWARE, sin volver a identificarse.
 *
 * Quien ya ha entrado en el software con su usuario no tiene por qué escribir
 * un código para ver una clase: se le reconoce por el correo de su usuario, se
 * le abre la sesión de alumno y se le deja en el portal.
 *
 * Si NO hay sesión del software, se le manda al portal por la puerta normal
 * (correo + código): no se cuela nadie por esta ruta.
 */
export async function GET(request: Request) {
  // El portal puede servirse en su propio dominio: se vuelve al MISMO host desde
  // el que se ha entrado, no a una dirección fija.
  const base = new URL(request.url).origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/escuela", base));

  const admin = createAdminClient();
  const { data: usuario } = await admin
    .from("usuarios")
    .select("email, nombre, apellidos, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // El correo de acceso es el de `usuarios.email`; el de `auth` es el respaldo.
  const email = ((usuario?.email as string) || user.email || "").trim();
  const nombre =
    [usuario?.nombre, usuario?.apellidos].filter(Boolean).join(" ").trim() ||
    ((usuario?.full_name as string) ?? "");
  const empresaId = await getEmpresaActivaForUser(supabase, user.id);

  if (!email) return NextResponse.redirect(new URL("/escuela", base));

  const alumnoId = await alumnoDesdeUsuario({
    email,
    nombre,
    userId: user.id,
    empresaClienteId: empresaId,
  });
  if (!alumnoId) return NextResponse.redirect(new URL("/escuela", base));

  await crearSesionAlumno(alumnoId);
  await registrarAcceso(alumnoId);
  return NextResponse.redirect(new URL("/escuela", base));
}
