/**
 * Script de ingesta one-shot: puebla Supabase con los datos extraídos de
 *   Desktop/SAAS/Logistica/*.pdf + FICHAS TECNICAS - PRODUCTO .xlsx
 *
 * Ejecutar:
 *   npx tsx src/features/logistica/services/ingest-from-pdfs/run-ingest.ts
 *
 * Usa SUPABASE_SERVICE_ROLE_KEY para bypasear RLS.
 * Es idempotente: si encuentra proveedores/productos/escandallos con la
 * misma clave, los actualiza en vez de duplicar.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { PROVEEDORES_SEED } from "./data-proveedores";
import { PRODUCTOS_VENTA_SEED } from "./data-productos-venta";
import {
  parseExcelEscandallos,
  extractIngredientesUnicos,
} from "./parse-excel-escandallos";

const EXCEL_PATH = "/Users/ivanballesteros/Desktop/SAAS/Logistica/FICHAS TECNICAS - PRODUCTO .xlsx";

// ─── 1. Cargar variables de entorno desde .env.local ──────

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) throw new Error(".env.local no encontrado en " + envPath);
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      const [, key, val] = match;
      if (!process.env[key]) process.env[key] = val.replace(/^["']|["']$/g, "");
    }
  }
}

// ─── 2. Utilidades ────────────────────────────────────────

function normalizarUnidad(raw: string): string {
  const u = raw.toLowerCase().trim();
  if (u.startsWith("kg") || u === "kilos" || u === "kilo") return "kg";
  if (u === "gr" || u === "g" || u === "gramo" || u === "gramos") return "kg"; // convertiremos gramos a kg
  if (u === "l" || u === "lt" || u === "litro" || u === "litros") return "L";
  if (u === "ml" || u === "mls") return "L";
  if (u === "uni" || u === "ud" || u === "uds" || u === "unidad" || u === "unidades") return "ud";
  return raw.toLowerCase();
}

/** Convierte la cantidad a la unidad normalizada (g → kg, ml → L). */
function cantidadNormalizada(cantidad: number, unidadRaw: string): number {
  const u = unidadRaw.toLowerCase().trim();
  if (u === "gr" || u === "g" || u === "gramo" || u === "gramos") return cantidad / 1000;
  if (u === "ml" || u === "mls") return cantidad / 1000;
  return cantidad;
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// ─── 3. Main ──────────────────────────────────────────────

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("🔌 Conectado a", url);

  // ─── Empresa ──────────────────────────────────────────
  console.log("\n📁 Empresa…");
  const { data: empresas, error: eErr } = await supabase
    .from("empresas")
    .select("id, nombre")
    .limit(1);
  if (eErr) throw eErr;

  let empresaId: string;
  if (!empresas || empresas.length === 0) {
    const { data: nueva, error } = await supabase
      .from("empresas")
      .insert({ nombre: "Balles-Hosteleros" })
      .select("id")
      .single();
    if (error) throw error;
    empresaId = nueva.id;
    console.log("  + creada:", empresaId);
  } else {
    empresaId = empresas[0].id;
    console.log("  ✓ existe:", empresaId, "—", empresas[0].nombre);
  }

  // ─── Proveedores ──────────────────────────────────────
  console.log("\n🚚 Proveedores…");
  const proveedorRows = PROVEEDORES_SEED.map((p) => ({
    empresa_id: empresaId,
    nombre_comercial: p.nombreComercial,
    razon_social: p.razonSocial ?? null,
    cif_nif: p.cifNif ?? null,
    categoria: p.categoria,
    estado: p.estado ?? "Activo",
    persona_contacto: p.personaContacto ?? null,
    telefono_principal: p.telefonoPrincipal ?? null,
    telefono_secundario: p.telefonoSecundario ?? null,
    telefono_comercial: p.telefonoComercial ?? null,
    email_principal: p.emailPrincipal ?? null,
    email_comercial: p.emailComercial ?? null,
    email_pedidos: p.emailPedidos ?? null,
    email_contabilidad: p.emailContabilidad ?? null,
    web: p.web ?? null,
    direccion: p.direccion ?? null,
    ciudad: p.ciudad ?? null,
    provincia: p.provincia ?? null,
    pais: p.pais ?? "España",
    codigo_postal: p.codigoPostal ?? null,
    dias_reparto: p.diasReparto ?? [],
    condiciones_pago: p.condicionesPago ?? null,
    plazo_entrega: p.plazoEntrega ?? null,
    observaciones: p.observaciones ?? null,
    comentarios_internos: p.comentariosInternos ?? null,
  }));

  // Borrar y reinsertar (idempotente para ingesta inicial)
  await supabase.from("proveedores").delete().eq("empresa_id", empresaId);
  const { error: pErr } = await supabase.from("proveedores").insert(proveedorRows);
  if (pErr) throw pErr;
  console.log("  ✓ insertados:", proveedorRows.length);

  // ─── Parsear Excel de escandallos ────────────────────
  console.log("\n📖 Leyendo Excel de escandallos…");
  const { escandallos, saltadas } = parseExcelEscandallos(EXCEL_PATH);
  console.log("  ✓ escandallos parseados:", escandallos.length);
  if (saltadas.length > 0) console.log("  ⚠ hojas sin escandallo detallado:", saltadas.join(", "));

  // ─── Productos de venta ──────────────────────────────
  // Combinar los del PDF (con agora_id) + los del Excel (algunos no están en PDF)
  console.log("\n🍽️  Productos de venta…");
  const ventaByKey = new Map<string, { agoraId: string | null; nombre: string; categoria: string }>();
  for (const pv of PRODUCTOS_VENTA_SEED) {
    ventaByKey.set(normalizeKey(pv.nombre), { agoraId: pv.agoraId, nombre: pv.nombre, categoria: pv.categoria });
  }
  // Añadir platos del Excel que no estén en el PDF
  for (const e of escandallos) {
    const key = normalizeKey(e.plato);
    if (!ventaByKey.has(key)) {
      // intentar match fuzzy por inclusión
      let matched = false;
      for (const [k, v] of ventaByKey.entries()) {
        if (k.includes(key) || key.includes(k)) {
          ventaByKey.set(key, v); // alias al mismo
          matched = true;
          break;
        }
      }
      if (!matched) {
        ventaByKey.set(key, { agoraId: null, nombre: e.plato, categoria: e.categoria });
      }
    }
  }

  const productosVentaRows = Array.from(new Set(Array.from(ventaByKey.values()))).map((pv) => ({
    empresa_id: empresaId,
    tipo: "venta" as const,
    nombre: pv.nombre,
    categoria: pv.categoria,
    estado: "Activo" as const,
    unidad: "ud",
    agora_id: pv.agoraId,
  }));

  // Dedupe por nombre (puede haber aliased duplicates)
  const seen = new Set<string>();
  const ventaDedup = productosVentaRows.filter((r) => {
    const k = r.nombre.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Limpiar productos de venta existentes de esta empresa y reinsertar
  await supabase.from("productos").delete().eq("empresa_id", empresaId).eq("tipo", "venta");
  const { data: ventaInserted, error: vErr } = await supabase
    .from("productos")
    .insert(ventaDedup)
    .select("id, nombre");
  if (vErr) throw vErr;
  console.log("  ✓ insertados:", ventaInserted?.length ?? 0);

  // Map nombre → id de producto de venta
  const ventaIdByKey = new Map<string, string>();
  for (const v of ventaInserted ?? []) {
    ventaIdByKey.set(normalizeKey(v.nombre), v.id);
  }

  // ─── Productos de compra (ingredientes únicos) ───────
  console.log("\n🥩 Productos de compra (ingredientes)…");
  const ingredientesMap = extractIngredientesUnicos(escandallos);
  console.log("  ingredientes únicos detectados:", ingredientesMap.size);

  const compraRows = Array.from(ingredientesMap.values()).map((ing) => {
    const unidadNorm = normalizarUnidad(ing.unidad);
    return {
      empresa_id: empresaId,
      tipo: "compra" as const,
      nombre: ing.nombre,
      categoria: "Sin categoría",
      estado: "Activo" as const,
      unidad: unidadNorm,
      precio_compra: String(ing.precio),
    };
  });

  await supabase.from("productos").delete().eq("empresa_id", empresaId).eq("tipo", "compra");
  const { data: compraInserted, error: cErr } = await supabase
    .from("productos")
    .insert(compraRows)
    .select("id, nombre");
  if (cErr) throw cErr;
  console.log("  ✓ insertados:", compraInserted?.length ?? 0);

  const compraIdByKey = new Map<string, string>();
  for (const c of compraInserted ?? []) {
    compraIdByKey.set(normalizeKey(c.nombre), c.id);
  }

  // ─── Escandallos ─────────────────────────────────────
  console.log("\n📊 Escandallos…");
  const escandalloRows: Array<{
    producto_venta_id: string;
    ingrediente_id: string;
    cantidad: number;
    merma_pct: number;
  }> = [];

  let sinMatchPlato = 0;
  let sinMatchIng = 0;
  const unmatchedPlatos = new Set<string>();
  const unmatchedIngs = new Set<string>();

  for (const e of escandallos) {
    const platoKey = normalizeKey(e.plato);
    const ventaId = ventaIdByKey.get(platoKey);
    if (!ventaId) {
      // fuzzy: buscar por inclusión
      let matched: string | null = null;
      for (const [k, v] of ventaIdByKey.entries()) {
        if (k.includes(platoKey) || platoKey.includes(k)) {
          matched = v;
          break;
        }
      }
      if (!matched) {
        sinMatchPlato += 1;
        unmatchedPlatos.add(e.plato);
        continue;
      }
      ventaIdByKey.set(platoKey, matched);
    }
    const venId = ventaIdByKey.get(platoKey)!;

    for (const ing of e.ingredientes) {
      const ingKey = normalizeKey(ing.nombre);
      const ingId = compraIdByKey.get(ingKey);
      if (!ingId) {
        sinMatchIng += 1;
        unmatchedIngs.add(ing.nombre);
        continue;
      }

      escandalloRows.push({
        producto_venta_id: venId,
        ingrediente_id: ingId,
        cantidad: cantidadNormalizada(ing.cantidad, ing.unidad),
        merma_pct: ing.mermaPct,
      });
    }
  }

  // Dedupe por (producto_venta_id, ingrediente_id) — si aparece 2 veces sumamos cantidades
  const dedupMap = new Map<string, { producto_venta_id: string; ingrediente_id: string; cantidad: number; merma_pct: number }>();
  for (const row of escandalloRows) {
    const key = `${row.producto_venta_id}__${row.ingrediente_id}`;
    const existing = dedupMap.get(key);
    if (existing) {
      existing.cantidad += row.cantidad;
    } else {
      dedupMap.set(key, { ...row });
    }
  }
  const finalRows = Array.from(dedupMap.values());

  // Limpiar escandallos existentes para platos de esta empresa
  const ventaIds = (ventaInserted ?? []).map((v) => v.id);
  if (ventaIds.length > 0) {
    await supabase.from("producto_composicion").delete().in("producto_venta_id", ventaIds);
  }

  if (finalRows.length > 0) {
    // Insertar en batches de 500 para evitar timeout
    const BATCH = 500;
    for (let i = 0; i < finalRows.length; i += BATCH) {
      const batch = finalRows.slice(i, i + BATCH);
      const { error } = await supabase.from("producto_composicion").insert(batch);
      if (error) throw error;
    }
  }

  console.log("  ✓ escandallos insertados:", finalRows.length);
  if (sinMatchPlato > 0) {
    console.log("  ⚠ platos sin match:", Array.from(unmatchedPlatos).slice(0, 10).join(", "));
  }
  if (sinMatchIng > 0) {
    console.log("  ⚠ ingredientes sin match (primeros 10):", Array.from(unmatchedIngs).slice(0, 10).join(", "));
  }

  // ─── Resumen ─────────────────────────────────────────
  console.log("\n✅ Ingesta completa");
  console.log("  Empresa:          ", empresaId);
  console.log("  Proveedores:      ", proveedorRows.length);
  console.log("  Productos venta:  ", ventaInserted?.length ?? 0);
  console.log("  Productos compra: ", compraInserted?.length ?? 0);
  console.log("  Escandallos:      ", finalRows.length);
}

main().catch((err) => {
  console.error("\n❌ Error en ingesta:");
  console.error(err);
  process.exit(1);
});
