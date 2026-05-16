import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "qa-test-bh@example.com";

const { data: list } = await admin.auth.admin.listUsers();
const u = list?.users?.find((x) => x.email === EMAIL);
if (u) {
  await admin.from("solicitudes_personal").delete().eq("user_id", u.id);
  await admin.from("user_roles").delete().eq("user_id", u.id);
  await admin.from("profiles").delete().eq("user_id", u.id);
  const { error } = await admin.auth.admin.deleteUser(u.id);
  console.log("deleted user:", u.id, error ?? "ok");
} else {
  console.log("user not found, nothing to delete");
}

// Reset el límite del tipo Baja médica (era null antes del test)
const { error: e2 } = await admin
  .from("tipos_ausencia")
  .update({ limite_dias: null })
  .eq("id", "7c343afa-7795-4b8b-9650-5c281f316dca");
console.log("reset limite:", e2 ?? "ok");
