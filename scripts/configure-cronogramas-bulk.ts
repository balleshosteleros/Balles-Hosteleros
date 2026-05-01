/**
 * Aplica defaults sensatos de calendario a todas las tareas de
 * cronogramas_operativos (solo principales, no subtareas) que no
 * tengan programación configurada.
 *
 * Reglas:
 *   DIARIO     → (sin cambios; aplica todos los días)
 *   SEMANAL    → dia_semana = [1,2,3,4,5] (lun-vie) si está vacío
 *   MENSUAL    → dia_mes = 1 si está vacío
 *   TRIMESTRAL → dia_mes = 1 + meses [1,4,7,10] si está vacío
 *   ANUAL      → fecha_anual = '01-15' si está vacío
 *   POR NECESIDAD / OTRO → no se tocan (no se siembran)
 *
 * También backfillea empresa_id de cronogramas_operativos usando la
 * empresa del primer admin encontrado.
 */
import * as fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1]!;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("❌ SUPABASE_ACCESS_TOKEN no definido en .env.local");
  process.exit(1);
}

async function q(sql: string): Promise<unknown> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body}`);
  try { return JSON.parse(body); } catch { return body; }
}

async function main() {
  console.log("⚙️  Configurando cronogramas existentes con defaults sensatos…\n");

  // 1) Backfill empresa_id (si hay tareas sin empresa y hay una única empresa)
  const empresas = (await q(
    "select id, nombre from public.empresas order by created_at limit 5"
  )) as Array<{ id: string; nombre: string }>;
  if (empresas.length === 1) {
    const eid = empresas[0].id;
    const r1 = await q(
      `update public.cronogramas_operativos set empresa_id = '${eid}' where empresa_id is null returning id`
    );
    console.log(`  ↳ Backfill empresa_id "${empresas[0].nombre}": ${(r1 as unknown[]).length} tareas.`);
  } else {
    console.log(`  ↳ Hay ${empresas.length} empresas. No backfilleo empresa_id automáticamente.`);
  }

  // 2) Defaults SEMANAL
  const r2 = (await q(`
    update public.cronogramas_operativos
    set dia_semana = array[1,2,3,4,5]
    where parent_id is null
      and frecuencia = 'SEMANAL'
      and (dia_semana is null or array_length(dia_semana,1) is null)
    returning id
  `)) as unknown[];
  console.log(`  ↳ SEMANAL → lun-vie: ${r2.length} tareas.`);

  // 3) Defaults MENSUAL
  const r3 = (await q(`
    update public.cronogramas_operativos
    set dia_mes = 1
    where parent_id is null
      and frecuencia = 'MENSUAL'
      and dia_mes is null
    returning id
  `)) as unknown[];
  console.log(`  ↳ MENSUAL → día 1: ${r3.length} tareas.`);

  // 4) Defaults TRIMESTRAL
  const r4 = (await q(`
    update public.cronogramas_operativos
    set
      dia_mes = coalesce(dia_mes, 1),
      meses_trimestrales = coalesce(meses_trimestrales, array[1,4,7,10])
    where parent_id is null
      and frecuencia = 'TRIMESTRAL'
      and (dia_mes is null or meses_trimestrales is null)
    returning id
  `)) as unknown[];
  console.log(`  ↳ TRIMESTRAL → día 1 (ene/abr/jul/oct): ${r4.length} tareas.`);

  // 5) Defaults ANUAL
  const r5 = (await q(`
    update public.cronogramas_operativos
    set fecha_anual = '01-15'
    where parent_id is null
      and frecuencia = 'ANUAL'
      and fecha_anual is null
    returning id
  `)) as unknown[];
  console.log(`  ↳ ANUAL → 15 enero: ${r5.length} tareas.`);

  // 6) Resumen
  const resumen = (await q(`
    select frecuencia, count(*) as n
    from public.cronogramas_operativos
    where parent_id is null
    group by frecuencia
    order by frecuencia
  `)) as Array<{ frecuencia: string; n: number }>;
  console.log("\n📊 Resumen de tareas principales por frecuencia:");
  for (const r of resumen) {
    console.log(`   ${r.frecuencia?.padEnd(15) ?? "(null)"} ${r.n}`);
  }

  console.log("\n✅ Configuración aplicada. Las tareas DIARIO/SEMANAL/MENSUAL/TRIMESTRAL/ANUAL se sembrarán automáticamente.");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
