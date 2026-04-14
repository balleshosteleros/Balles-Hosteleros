import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
const c = fs.readFileSync(".env.local", "utf-8");
for (const l of c.split("\n")) {
  const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await s.from("cronogramas_operativos").select("id, resumen, video_url, id_visible, parent_id, orden").limit(1);
  console.log({ ok: !error, error: error?.message, sample: data });
}
main();
