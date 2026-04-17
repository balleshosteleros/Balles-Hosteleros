import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve("/Users/ivanballesteros/Balles Hosteleros", ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  const { count: totalTickets } = await supabase
    .from("pos_tickets")
    .select("*", { count: "exact", head: true });
  console.log("Total pos_tickets en BD:", totalTickets);

  const { data: lastTickets } = await supabase
    .from("pos_tickets")
    .select("id, numero, estado, enviado_at, abierto_at, empresa_id")
    .order("abierto_at", { ascending: false })
    .limit(5);
  console.log("\nÚltimos 5 tickets (cualquier fecha):");
  for (const t of lastTickets ?? []) {
    const tt = t as { numero: string; estado: string; enviado_at: string | null; abierto_at: string };
    console.log(`  #${tt.numero} · ${tt.estado} · abierto=${tt.abierto_at} · enviado=${tt.enviado_at ?? "NULL"}`);
  }

  const { count: totalLineas } = await supabase
    .from("pos_ticket_lineas")
    .select("*", { count: "exact", head: true });
  console.log("\nTotal pos_ticket_lineas en BD:", totalLineas);

  const { data: lastLineas } = await supabase
    .from("pos_ticket_lineas")
    .select("nombre, destino, enviada_at, estado_cocina, created_at")
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\nÚltimas 5 líneas (cualquier fecha):");
  for (const l of lastLineas ?? []) {
    const ll = l as { nombre: string; destino: string; enviada_at: string | null; estado_cocina: string; created_at: string };
    console.log(`  ${ll.nombre} · ${ll.destino} · estado_cocina=${ll.estado_cocina} · enviada_at=${ll.enviada_at ?? "NULL"}`);
  }

  console.log("\nDEV_BYPASS_AUTH =", process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH);
})();
