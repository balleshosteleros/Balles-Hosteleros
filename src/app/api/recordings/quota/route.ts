import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getEmpresaActivaForUser } from "@/features/empresa/lib/empresa-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Etiquetas legibles por tipo de contenido almacenado en `recordings`.
const TIPO_LABELS: Record<string, string> = {
  grabacion: "Grabaciones de pantalla",
  formacion: "Formación",
  marketing: "Marketing",
  onboarding: "Onboarding",
};

/**
 * Qué nombre recibe cada bucket de Supabase Storage en el desglose. Aquí vive
 * lo que el software genera solo: nóminas, contratos, albaranes, fotos de la
 * carta... Un bucket que no esté en esta lista se agrupa en "Otros documentos"
 * en vez de desaparecer: los bytes tienen que cuadrar con el total.
 */
const BUCKET_LABELS: Record<string, string> = {
  "rrhh-nominas": "Nóminas",
  "empleados-docs": "Documentos de empleados",
  "contratos-gestoria": "Contratos",
  firmas: "Firmas",
  "logistica-albaranes": "Albaranes",
  "logistica-facturas": "Facturas",
  "modelos-aeat-pdf": "Modelos fiscales",
  "carta-fotos": "Fotos de la carta",
  "paginas-web-assets": "Páginas web",
  "cvs-candidatos": "CV de candidatos",
  "documentacion-candidatos": "Documentación de candidatos",
  "cierres-documentos": "Cierres",
  "chat-archivos": "Chat",
  "empresa-logos": "Imagen de marca",
  "estudios-apertura-fotos": "Estudios de apertura",
  "inspeccion-imagenes": "Inspecciones",
  "juridico-documentos": "Jurídico",
  documentacion: "Documentación",
  "formacion-docs": "Formación",
  "gerencia-informes": "Informes",
  "cronogramas-videos": "Cronogramas",
  "nuevas-recetas-fotos-cata": "Recetas",
};

// GET — almacenamiento de la empresa del usuario autenticado:
// cuota total (bytes_used / bytes_limit) + desglose por tipo de contenido.
export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // La empresa la manda el selector (cookie), no la de origen del usuario:
    // si no, el almacenamiento de una empresa se vería desde otra.
    const empresaId = await getEmpresaActivaForUser(supabase, user.id);

    if (!empresaId) {
      return NextResponse.json({ error: "Usuario sin empresa asignada" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Cuota total de la empresa
    const { data: usage } = await admin
      .from("storage_usage_por_empresa")
      .select("bytes_used, bytes_limit")
      .eq("empresa_id", empresaId)
      .single();

    // Desglose por tipo: sumamos file_size agrupando por `type`.
    const { data: rows } = await admin
      .from("recordings")
      .select("type, file_size")
      .eq("empresa_id", empresaId);

    const porTipo = new Map<string, { bytes: number; count: number }>();
    for (const r of rows ?? []) {
      const tipo = (r.type as string) || "grabacion";
      const prev = porTipo.get(tipo) ?? { bytes: 0, count: 0 };
      prev.bytes += Number(r.file_size ?? 0);
      prev.count += 1;
      porTipo.set(tipo, prev);
    }

    const desglose = Array.from(porTipo.entries()).map(([tipo, v]) => ({
      tipo,
      label: TIPO_LABELS[tipo] ?? tipo,
      bytes: v.bytes,
      count: v.count,
    }));

    // Documentos de Supabase Storage: nóminas, albaranes, contratos, fotos de
    // la carta... Sin esto el desglose salía vacío aunque el total no lo fuera.
    const { data: buckets } = await admin.rpc("storage_desglose_por_bucket", {
      p_empresa_id: empresaId,
    });

    let otros = { bytes: 0, count: 0 };
    for (const b of (buckets ?? []) as {
      bucket: string;
      bytes: number;
      files: number;
    }[]) {
      const label = BUCKET_LABELS[b.bucket];
      const bytes = Number(b.bytes ?? 0);
      const count = Number(b.files ?? 0);
      if (label) {
        desglose.push({ tipo: b.bucket, label, bytes, count });
      } else {
        // Un bucket nuevo no debe evaporarse del desglose: se agrupa.
        otros = { bytes: otros.bytes + bytes, count: otros.count + count };
      }
    }
    if (otros.bytes > 0) {
      desglose.push({
        tipo: "otros",
        label: "Otros documentos",
        bytes: otros.bytes,
        count: otros.count,
      });
    }

    // De mayor a menor: lo que ocupa se ve primero.
    desglose.sort((a, b) => b.bytes - a.bytes);

    return NextResponse.json({
      bytes_used: Number(usage?.bytes_used ?? 0),
      bytes_limit: Number(usage?.bytes_limit ?? 500 * 1024 ** 3),
      desglose,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al obtener el almacenamiento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
