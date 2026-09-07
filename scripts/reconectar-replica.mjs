/**
 * PRP-088 — Devuelve la acción a los botones de una página ya clonada, sin
 * volver a clonarla.
 *
 * Al quitar los scripts del origen, los botones se quedan mudos. Esto les
 * engancha lo nuestro: pedir los datos (que caen en `leads_web`) y pasar al
 * siguiente paso del embudo. Se puede repetir tantas veces como haga falta: el
 * bloque anterior se sustituye, no se acumula.
 *
 * Uso:
 *   node scripts/reconectar-replica.mjs --empresa <uuid> --pagina <slug> \
 *        [--paso-siguiente /vsl] [--pedir-datos] [--titulo-formulario "…"]
 *   node scripts/reconectar-replica.mjs --empresa <uuid> --pagina <slug> --quitar
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { bloqueDeReconexion } from "./lib/reconexion-replica.mjs";

for (const linea of readFileSync(".env.local", "utf8").split("\n")) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const args = process.argv.slice(2);
const leer = (b) => {
  const i = args.indexOf(b);
  return i >= 0 ? args[i + 1] : null;
};

const empresaId = leer("--empresa");
const slug = leer("--pagina");
if (!empresaId || !slug) {
  console.error("Faltan --empresa y --pagina");
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: pagina, error } = await sb
  .from("paginas_web")
  .select("id, html_replica")
  .eq("empresa_id", empresaId)
  .eq("slug_interno", slug)
  .single();
if (error || !pagina?.html_replica) {
  console.error(`No hay copia guardada para «${slug}»: ${error?.message ?? "sin html"}`);
  process.exit(1);
}

// Marcadores para poder sustituir la reconexión anterior en vez de encadenarlas.
const INICIO = "<!-- Reconexión con el software (PRP-088). Este bloque es NUESTRO, no del origen. -->";
const FIN = "<!-- /Reconexión -->";

let html = pagina.html_replica;
const desde = html.indexOf(INICIO);
if (desde >= 0) {
  const hasta = html.indexOf(FIN, desde);
  html = hasta >= 0 ? html.slice(0, desde) + html.slice(hasta + FIN.length) : html.slice(0, desde);
}

if (!args.includes("--quitar")) {
  const bloque = bloqueDeReconexion({
    empresaId,
    paginaId: pagina.id,
    siguiente: leer("--paso-siguiente"),
    pedirDatos: args.includes("--pedir-datos"),
    tituloFormulario: leer("--titulo-formulario") ?? "Déjanos tus datos y sigue",
  });
  html = html.includes("</body>") ? html.replace("</body>", `${bloque}</body>`) : html + bloque;
}

const { error: errUpd } = await sb.from("paginas_web").update({ html_replica: html }).eq("id", pagina.id);
if (errUpd) {
  console.error(`No se pudo guardar: ${errUpd.message}`);
  process.exit(1);
}

console.log(
  args.includes("--quitar")
    ? `✓ ${slug}: reconexión retirada`
    : `✓ ${slug}: botones reconectados${args.includes("--pedir-datos") ? " (piden datos)" : ""}${leer("--paso-siguiente") ? ` → ${leer("--paso-siguiente")}` : ""}`,
);
