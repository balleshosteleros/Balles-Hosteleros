/**
 * Vincula cada ingrediente con un proveedor por defecto (MAKRO como genérico),
 * usando el precio promedio calculado de los escandallos.
 *
 * Esto es un seed inicial — después el usuario puede reasignar proveedores
 * reales desde la UI (el ingrediente de carne → SOLOBUEY, pescado → GARCIMAR, etc.).
 *
 * Ejecutar:
 *   npx tsx src/features/logistica/services/ingest-from-pdfs/link-proveedores-default.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, val] = match;
      if (!process.env[key]) process.env[key] = val.replace(/^["']|["']$/g, "");
    }
  }
}

async function main() {
  loadEnv();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const EMPRESA_ID = "00000000-0000-0000-0000-000000000001";

  // 1. Buscar MAKRO como proveedor por defecto
  const { data: makro } = await supabase
    .from("proveedores")
    .select("id, nombre_comercial")
    .eq("empresa_id", EMPRESA_ID)
    .eq("nombre_comercial", "MAKRO")
    .single();

  if (!makro) {
    console.error("No se encontró MAKRO como proveedor");
    process.exit(1);
  }
  console.log("✓ Proveedor por defecto:", makro.nombre_comercial, makro.id);

  // 2. Obtener todos los ingredientes (tipo=compra) con su precio
  const { data: ingredientes } = await supabase
    .from("productos")
    .select("id, nombre, precio_compra")
    .eq("empresa_id", EMPRESA_ID)
    .eq("tipo", "compra");

  console.log("✓ Ingredientes:", ingredientes?.length ?? 0);

  // 3. Crear filas en ingredientes_proveedor
  const rows = (ingredientes ?? []).map((ing) => {
    const precio = Number(ing.precio_compra ?? "0") || 0;
    return {
      producto_id: ing.id,
      proveedor_id: makro.id,
      precio_unitario: precio,
      es_preferido: true,
      ultimo_precio_fecha: new Date().toISOString().slice(0, 10),
    };
  });

  // Borrar existentes y reinsertar
  const productoIds = rows.map((r) => r.producto_id);
  if (productoIds.length > 0) {
    await supabase.from("ingredientes_proveedor").delete().in("producto_id", productoIds);
  }

  const { error } = await supabase.from("ingredientes_proveedor").insert(rows);
  if (error) throw error;

  console.log("✅ Vinculaciones creadas:", rows.length);

  // 4. Test: calcular food cost de los primeros 10 platos
  console.log("\n📊 Food cost de los primeros platos:");
  const { data: platos } = await supabase
    .from("productos")
    .select("id, nombre, precio_venta")
    .eq("empresa_id", EMPRESA_ID)
    .eq("tipo", "venta")
    .limit(15);

  for (const p of platos ?? []) {
    const { data: coste } = await supabase.rpc("coste_escandallo", {
      p_producto_venta_id: p.id,
    });
    const costeNum = Number(coste ?? 0);
    if (costeNum > 0) {
      console.log(`  ${p.nombre.padEnd(50)} €${costeNum.toFixed(2)} coste`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
