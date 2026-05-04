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
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = url.match(/https:\/\/([^.]+)\./)?.[1];

async function q(sql: string) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  console.log(`SQL: ${sql.slice(0, 80)}...`);
  console.log(`Status: ${res.status}`);
  const body = await res.text();
  console.log(`Body: ${body.slice(0, 800)}\n`);
}

(async () => {
  await q(
    `select conname, pg_get_constraintdef(c.oid) as def from pg_constraint c join pg_class t on t.oid = c.conrelid where t.relname='documentos_juridicos';`
  );
})();
