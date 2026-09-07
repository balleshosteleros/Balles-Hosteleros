/**
 * PRP-088 — Cambia el calendario muerto de una página clonada por el nuestro.
 *
 * El calendario que se copia de GoHighLevel enseña las horas del día en que se
 * hizo la captura y no reserva nada: engaña, porque parece que funciona. Esto
 * lo sustituye por el selector de huecos del software.
 *
 * Uso:
 *   node scripts/insertar-widget-citas.mjs --empresa <uuid> --pagina agendar \
 *        --calendario <uuid-del-calendario> [--selector "#calendarAppointmentBookingMain"]
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parse } from "node-html-parser";
import { widgetDeCitas } from "./lib/widget-citas.mjs";

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
const calendarioId = leer("--calendario");
// Contenedor del calendario original. En las páginas de GoHighLevel es
// `#calendarAppointmentBookingMain`; se puede cambiar si otra web usa otro.
const selector = leer("--selector") ?? "#calendarAppointmentBookingMain";

if (!empresaId || !slug || !calendarioId) {
  console.error(
    "Uso: node scripts/insertar-widget-citas.mjs --empresa <uuid> --pagina <slug> --calendario <uuid>",
  );
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: pagina, error } = await sb
  .from("paginas_web")
  .select("id, nombre, html_replica")
  .eq("empresa_id", empresaId)
  .eq("slug_interno", slug)
  .single();

if (error || !pagina?.html_replica) {
  console.error(`No hay copia guardada para «${slug}»: ${error?.message ?? "sin html"}`);
  process.exit(1);
}

// Comprobar que el calendario existe y es de esta empresa: meter el de otra
// dejaría a la página reservando en la agenda equivocada.
const { data: cal } = await sb
  .from("citas_calendarios")
  .select("id, nombre, empresa_id")
  .eq("id", calendarioId)
  .maybeSingle();
if (!cal || cal.empresa_id !== empresaId) {
  console.error("Ese calendario no existe o es de otra empresa.");
  process.exit(1);
}

const root = parse(pagina.html_replica);
const destino = root.querySelector(selector);
if (!destino) {
  console.error(`No se ha encontrado «${selector}» en la página. Nada que sustituir.`);
  process.exit(1);
}

destino.replaceWith(
  widgetDeCitas({
    calendarioId,
    paginaId: pagina.id,
    origen: `Embudo · ${pagina.nombre ?? slug}`,
  }),
);

const { error: errUpd } = await sb
  .from("paginas_web")
  .update({ html_replica: root.toString() })
  .eq("id", pagina.id);

if (errUpd) {
  console.error(`No se pudo guardar: ${errUpd.message}`);
  process.exit(1);
}

console.log(`✓ ${slug}: el calendario ahora es «${cal.nombre}» y reserva de verdad.`);
