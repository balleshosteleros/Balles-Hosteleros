/**
 * Comprueba el candado de rol del asistente con preguntas reales.
 *
 * Hace la MISMA pregunta con los módulos de un director (todos) y con los de un
 * camarero (sala y lo general), y enseña qué recupera cada uno. Sirve para ver
 * de un vistazo que un empleado de sala no saca nada de nóminas.
 *
 * Uso:
 *   npx tsx scripts/probar-candado-asistente.ts
 */
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const TODOS = [
  "DIRECCIÓN", "SALA", "COCINA", "GERENCIA", "CALIDAD", "RECURSOS HUMANOS",
  "MARKETING", "LOGÍSTICA", "CONTABILIDAD", "GESTORÍA", "JURÍDICO", "PRODUCTO",
  "AJUSTES", "GENERAL",
];
const CAMARERO = ["SALA", "GENERAL"];

const PREGUNTAS = [
  "¿cómo veo mi nómina?",
  "¿cuánto cobra un jefe de cocina y dónde se cambia su sueldo?",
  "¿cómo apunto una reserva de esta noche?",
  "¿cómo monto un escandallo?",
  "¿cómo doy de baja a un trabajador?",
  "¿cómo fichar la entrada?",
  "¿cuál es la capital de Francia?",
];

async function main() {
  const { buscarConocimiento } = await import(
    "../src/features/soporte/services/buscar-conocimiento"
  );

  for (const p of PREGUNTAS) {
    console.log(`\n── ${p}`);
    for (const [quien, modulos] of [["DIRECTOR", TODOS], ["CAMARERO", CAMARERO]] as const) {
      const chunks = await buscarConocimiento(p, modulos as string[], 3);
      const resumen = chunks.length
        ? chunks.map((c) => `${c.modulo}/${c.titulo} (${c.distancia.toFixed(3)})`).join(" · ")
        : "— nada —";
      console.log(`   ${quien.padEnd(9)} ${resumen}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
