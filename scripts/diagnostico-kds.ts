/**
 * Diagnóstico del panel Comandas (KDS).
 * Uso: npx tsx scripts/diagnostico-kds.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  DIAGNÓSTICO KDS — /cocina/comandas");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 1. Verificar que existe la columna estado_cocina
  console.log("1️⃣  Columnas nuevas en pos_ticket_lineas:");
  const { data: cols } = await supabase.rpc("pg_typeof_query", {}).select().maybeSingle();
  // Fallback: query information_schema via REST
  const { data: lineaSample, error: errSample } = await supabase
    .from("pos_ticket_lineas")
    .select("id, estado_cocina, preparando_at, listo_at, servido_at, enviada_at, partida_id, prioridad")
    .limit(1);
  if (errSample) {
    console.log("   ❌ ERROR — la migración 037 NO se aplicó:", errSample.message);
    console.log("   👉 Pega el SQL de supabase/migrations/037_cocina_comandas.sql en Supabase Studio.");
    process.exit(1);
  }
  console.log("   ✅ Columnas existen (sample:", lineaSample?.[0] ?? "sin líneas aún", ")\n");

  // 2. Publication
  console.log("2️⃣  Publication supabase_realtime:");
  const { data: pubs, error: errPubs } = await supabase
    .from("pg_publication_tables" as never)
    .select("*")
    .eq("pubname", "supabase_realtime");
  if (errPubs) {
    console.log("   ⚠️  No se pudo consultar pg_publication_tables (normal vía REST). Verifica manual en Studio.");
  } else {
    const tablas = (pubs as Array<{ tablename: string }>).map((p) => p.tablename);
    const tieneLineas = tablas.includes("pos_ticket_lineas");
    const tieneTickets = tablas.includes("pos_tickets");
    console.log(`   ${tieneLineas ? "✅" : "❌"} pos_ticket_lineas en publication`);
    console.log(`   ${tieneTickets ? "✅" : "❌"} pos_tickets en publication\n`);
  }

  // 3. Tickets de hoy con enviado_at
  console.log("3️⃣  Tickets enviados hoy:");
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const { data: tickets, error: errT } = await supabase
    .from("pos_tickets")
    .select("id, numero, mesa_id, empresa_id, estado, enviado_at, abierto_at")
    .gte("abierto_at", inicioHoy.toISOString())
    .order("abierto_at", { ascending: false })
    .limit(10);

  if (errT) {
    console.log("   ❌ Error:", errT.message);
  } else if (!tickets || tickets.length === 0) {
    console.log("   ⚠️  No hay tickets hoy. ¿Has creado alguno?\n");
  } else {
    for (const t of tickets) {
      const tt = t as {
        numero: string;
        estado: string;
        enviado_at: string | null;
        empresa_id: string;
        id: string;
      };
      console.log(
        `   #${tt.numero} · estado=${tt.estado} · enviado_at=${tt.enviado_at ?? "NULL"} · empresa=${tt.empresa_id.substring(0, 8)}`,
      );
    }
    console.log();
  }

  // 4. Líneas enviadas con estado_cocina
  console.log("4️⃣  Últimas 15 líneas enviadas a cocina:");
  const { data: lineas, error: errL } = await supabase
    .from("pos_ticket_lineas")
    .select("id, ticket_id, nombre, destino, enviada_at, estado_cocina, preparando_at, listo_at, servido_at")
    .not("enviada_at", "is", null)
    .order("enviada_at", { ascending: false })
    .limit(15);

  if (errL) {
    console.log("   ❌ Error:", errL.message);
  } else if (!lineas || lineas.length === 0) {
    console.log("   ⚠️  No hay líneas con enviada_at. ¿Has pulsado 'Enviar a cocina'?\n");
  } else {
    for (const l of lineas) {
      const ll = l as {
        nombre: string;
        destino: string;
        enviada_at: string;
        estado_cocina: string;
      };
      console.log(
        `   ${ll.estado_cocina.padEnd(11)} · ${ll.destino.padEnd(7)} · ${ll.nombre.substring(0, 30).padEnd(30)} · ${ll.enviada_at}`,
      );
    }
    console.log();
  }

  // 5. Simulación de fetch del KDS
  console.log("5️⃣  Simulación de fetchComandasAbiertas (sin RLS):");
  const hace60s = new Date(Date.now() - 60_000).toISOString();
  const { data: simTickets } = await supabase
    .from("pos_tickets")
    .select("id")
    .gte("abierto_at", inicioHoy.toISOString())
    .not("enviado_at", "is", null)
    .in("estado", ["ABIERTO", "ENVIADO", "COBRADO"]);

  const ticketIds = (simTickets ?? []).map((t) => (t as { id: string }).id);
  console.log(`   Tickets candidatos: ${ticketIds.length}`);

  if (ticketIds.length > 0) {
    const { data: simLineas } = await supabase
      .from("pos_ticket_lineas")
      .select("id, estado_cocina, destino, nombre")
      .in("ticket_id", ticketIds)
      .not("enviada_at", "is", null)
      .or(`estado_cocina.neq.SERVIDO,servido_at.gte.${hace60s}`)
      .neq("estado_cocina", "CANCELADA");
    console.log(`   Líneas activas que deberían aparecer en el KDS: ${simLineas?.length ?? 0}`);
    for (const l of (simLineas ?? []) as Array<{ nombre: string; estado_cocina: string; destino: string }>) {
      console.log(`     · ${l.estado_cocina.padEnd(11)} · ${l.destino.padEnd(7)} · ${l.nombre}`);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  DIAGNÓSTICO TERMINADO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((e) => {
  console.error("\n💥 Error en diagnóstico:", e);
  process.exit(1);
});
