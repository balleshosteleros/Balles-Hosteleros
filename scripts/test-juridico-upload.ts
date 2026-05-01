/**
 * Smoke test: verifica que el bucket existe, las columnas nuevas están,
 * y que un insert + un upload de prueba funcionan con service-role.
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

const BUCKET = "juridico-documentos";

async function main() {
  // 1) Bucket existe
  const buckets = await supabase.storage.listBuckets();
  const found = buckets.data?.find((b) => b.id === BUCKET);
  console.log(found ? `✅ Bucket '${BUCKET}' existe (public=${found.public})` : `❌ Bucket '${BUCKET}' NO existe`);

  // 2) Columnas nuevas
  const colsRes = await fetch(
    `https://api.supabase.com/v1/projects/${url.match(/https:\/\/([^.]+)\./)![1]}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `select column_name from information_schema.columns where table_schema='public' and table_name='documentos_juridicos' and column_name in ('storage_path','size_bytes','actualizacion_id') order by column_name;`,
      }),
    }
  );
  const cols = (await colsRes.json()) as Array<{ column_name: string }>;
  const expected = ["actualizacion_id", "size_bytes", "storage_path"];
  const have = cols.map((c) => c.column_name).sort();
  console.log(`✅ Columnas nuevas: ${have.join(", ") || "(ninguna)"} ${JSON.stringify(have) === JSON.stringify(expected) ? "" : "❌"}`);

  // 3) Buscar un proceso real para probar (cualquier empresa)
  const { data: procesos } = await supabase.from("procesos_juridicos").select("id, empresa_id").limit(1);
  if (!procesos || procesos.length === 0) {
    console.log("⚠️  No hay procesos en BD; salteo upload de prueba");
    return;
  }
  const proceso = procesos[0];

  // 4) Subir un PDF de prueba pequeño
  const fakeContent = Buffer.from("%PDF-1.4\n% test\n");
  const storagePath = `${proceso.empresa_id}/${proceso.id}/test_${Date.now()}.pdf`;

  const upRes = await supabase.storage.from(BUCKET).upload(storagePath, fakeContent, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upRes.error) {
    console.log(`❌ Upload falló: ${upRes.error.message}`);
    return;
  }
  console.log(`✅ Upload OK → ${storagePath}`);

  // 5) Insert en documentos_juridicos
  const ins = await supabase
    .from("documentos_juridicos")
    .insert({
      empresa_id: proceso.empresa_id,
      proceso_id: proceso.id,
      nombre: "Smoke test",
      categoria: "Otro",
      descripcion: "doc creado por smoke test",
      storage_path: storagePath,
      size_bytes: fakeContent.length,
      tipo_mime: "application/pdf",
      subido_por: "smoke-test",
      estado: "Pendiente revisar",
    })
    .select("id")
    .single();
  if (ins.error || !ins.data) {
    console.log(`❌ Insert falló: ${ins.error?.message}`);
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return;
  }
  console.log(`✅ Insert OK → row id ${ins.data.id}`);

  // 6) Signed URL
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  console.log(signed.data?.signedUrl ? `✅ Signed URL generada (1m)` : `❌ Signed URL falló: ${signed.error?.message}`);

  // 7) Cleanup
  await supabase.from("documentos_juridicos").delete().eq("id", ins.data.id);
  await supabase.storage.from(BUCKET).remove([storagePath]);
  console.log("🧹 Cleanup OK");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
