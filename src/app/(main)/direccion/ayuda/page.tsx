import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRolContext } from "@/features/auth/actions/permisos-actions";
import { puedeEditarModulo } from "@/features/auth/lib/permisos";
import { listAllFaqs } from "@/features/soporte/actions/faq-actions";
import { listHuecos } from "@/features/soporte/actions/huecos-actions";
import {
  listConocimiento,
  estadoIndice,
} from "@/features/soporte/actions/conocimiento-actions";
import { AyudaDireccionView } from "@/features/soporte/components";

/**
 * Dirección → Ayuda.
 *
 * Aquí se gestiona todo lo de la ayuda: las preguntas frecuentes que se escriben
 * solas, lo que sabe el asistente y lo que falta por explicarle. Antes vivía en
 * Ayuda, detrás del permiso de Ajustes; es una decisión de dirección, no una
 * configuración del software.
 */
export default async function AyudaDireccionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { permisos } = await getRolContext();
  if (!puedeEditarModulo(permisos, "DIRECCIÓN")) redirect("/ayuda");

  const [faqs, conocimiento, estado, huecos] = await Promise.all([
    listAllFaqs().catch(() => []),
    listConocimiento().catch(() => []),
    estadoIndice().catch(() => ({
      total: 0,
      porFuente: {},
      porModulo: {},
      sinEmbedding: 0,
    })),
    listHuecos().catch(() => []),
  ]);

  return (
    <AyudaDireccionView
      faqs={faqs}
      conocimiento={conocimiento}
      estadoConocimiento={estado}
      huecos={huecos}
    />
  );
}
