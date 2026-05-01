/**
 * Asigna rol_label='Dirección' a todos los profiles que actualmente
 * no tienen rol_label o lo tienen vacío.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("user_id, email, rol_label");

  if (error) {
    console.error("❌", error.message);
    process.exit(1);
  }

  const targets = (profiles ?? []).filter((p) => !p.rol_label || p.rol_label.trim() === "");
  console.log(`📋 ${targets.length} profiles sin rol → se asigna 'Dirección'`);

  for (const p of targets) {
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ rol_label: "Dirección" })
      .eq("user_id", p.user_id);
    if (updErr) console.error(`   ❌ ${p.email}: ${updErr.message}`);
    else console.log(`   ✅ ${p.email} → Dirección`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
