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

(async () => {
  // Fetch directo al REST endpoint
  const resp = await fetch(`${url}/rest/v1/empleados`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      empresa_id: "d3b0aaaa-0000-0000-0000-000000000001",
      nombre: "TEST EMPLEADO",
    }),
  });
  console.log("status:", resp.status);
  const text = await resp.text();
  console.log("body:", text.slice(0, 500));
})();
