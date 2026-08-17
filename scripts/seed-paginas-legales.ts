/**
 * Crea las páginas legales (privacidad, aviso legal, cookies) de todas las
 * empresas que aún no las tengan.
 *
 * Usa exactamente el mismo generador que el botón del editor, así que el
 * resultado es idéntico al que obtendría el usuario pulsándolo.
 *
 * Idempotente: si la página ya existe para ese slug, la actualiza en lugar de
 * duplicarla. Se dejan en BORRADOR — publicar es decisión del usuario.
 *
 * Uso:  npx tsx scripts/seed-paginas-legales.ts
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { generarTextosLegales } from "../src/features/marketing/pagina-web/services/textos-legales";
import { sanitizarHtml } from "../src/features/marketing/pagina-web/services/sanitize-html";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: empresas, error } = await supabase
    .from("empresas")
    .select("id, nombre, datos_generales")
    .order("nombre");

  if (error) {
    console.error("Error leyendo empresas:", error.message);
    process.exit(1);
  }

  for (const empresa of empresas ?? []) {
    console.log(`\n── ${empresa.nombre} ──`);

    const { paginas, avisos } = generarTextosLegales(
      empresa.datos_generales as Record<string, unknown> | null,
    );

    for (const pagina of paginas) {
      const bloques = [
        {
          id: randomUUID(),
          tipo: "texto_libre",
          orden: 0,
          visible: true,
          datos: { html_seguro: sanitizarHtml(pagina.html) },
        },
      ];

      const seo = {
        title: pagina.titulo,
        description: `${pagina.titulo} de ${empresa.nombre}.`,
        robots: "noindex, follow",
      };

      const { data: existente } = await supabase
        .from("paginas_web")
        .select("id")
        .eq("empresa_id", empresa.id)
        .eq("slug_interno", pagina.slug)
        .maybeSingle();

      if (existente) {
        const { error: errUpd } = await supabase
          .from("paginas_web")
          .update({
            bloques,
            seo,
            nombre: pagina.nombre,
            legal_tipo: pagina.tipo,
            legal_generada_at: new Date().toISOString(),
          })
          .eq("id", (existente as { id: string }).id);

        if (errUpd) console.error(`  ✗ ${pagina.nombre}: ${errUpd.message}`);
        else console.log(`  ↻ ${pagina.nombre} (actualizada)`);
        continue;
      }

      const { error: errIns } = await supabase.from("paginas_web").insert({
        empresa_id: empresa.id,
        tipo: "ONE_PAGE",
        nombre: pagina.nombre,
        slug_interno: pagina.slug,
        bloques,
        seo,
        estado: "BORRADOR",
        legal_tipo: pagina.tipo,
        legal_generada_at: new Date().toISOString(),
      });

      if (errIns) console.error(`  ✗ ${pagina.nombre}: ${errIns.message}`);
      else console.log(`  ✓ ${pagina.nombre} (creada)`);
    }

    if (avisos.length > 0) {
      console.log("  ⚠ Datos pendientes en Ajustes:");
      for (const a of avisos) console.log(`     - ${a}`);
    }
  }

  console.log("\nHecho. Las páginas quedan en BORRADOR: revísalas y publícalas.");
}

main().catch((err) => {
  console.error("Fallo inesperado:", err);
  process.exit(1);
});
