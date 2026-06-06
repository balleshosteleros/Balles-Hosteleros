// TEMP (borrar tras prueba). Genera sesión válida por email vía service-role,
// sin tocar la contraseña. Emite cookies en formato @supabase/ssr.
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { createChunks } = require("@supabase/ssr/dist/main/utils/chunker.js");
const { stringToBase64URL } = require("@supabase/ssr/dist/main/utils/base64url.js");

// Parse .env.local sin dependencias.
const env = {};
for (const line of readFileSync(new URL("./.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];
if (!email) { console.error("uso: <email>"); process.exit(1); }

const ref = new URL(SUPA).hostname.split(".")[0];
const cookieName = `sb-${ref}-auth-token`;
const admin = createClient(SUPA, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(SUPA, ANON, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (linkErr) { console.error("generateLink:", linkErr.message); process.exit(1); }
const otp = linkData.properties?.email_otp;
if (!otp) { console.error("sin email_otp"); process.exit(1); }
const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({ email, token: otp, type: "email" });
if (verifyErr) { console.error("verifyOtp:", verifyErr.message); process.exit(1); }
const session = verifyData.session;
const value = JSON.stringify(session);
const encoded = "base64-" + stringToBase64URL(value);
const chunks = createChunks(cookieName, encoded);
console.log(JSON.stringify({ cookieName, ref, cookies: chunks, userId: session.user.id }));
