/**
 * Ingest de elaboraciones desde el Excel "FICHAS TECNICAS - ELABORACIONES (1).xlsx".
 *
 * Estructura de cada hoja:
 *   Row 0 col 0: Puede ser "SALSA" (categoría) o el nombre de la elaboración.
 *   La fila de cabeceras contiene "INGREDIENTES" en col 6 y "UNIDAD" col 9 y "CANTIDAD" col 10.
 *   Los ingredientes empiezan 1-2 filas después, con [_, _, _, _, _, _, nombre, _, _, unidad, cantidad].
 *
 * Por cada hoja:
 *   1) Crea/actualiza producto tipo='elaboracion' con nombre = sheet name.
 *   2) Por cada ingrediente:
 *      - Busca producto de compra existente por nombre (case-insensitive, match parcial).
 *      - Si no existe, crea nuevo producto tipo='compra' con categoria "Sin categoría".
 *      - Inserta fila en `escandallos` con producto_venta_id = elaboración, ingrediente_id = compra.
 */
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EXCEL = "/Users/ivanballesteros/Desktop/SAAS/Logistica/FICHAS TECNICAS - ELABORACIONES (1).xlsx";

function normalizarUnidad(raw: string): string {
  const u = (raw || "").toLowerCase().trim();
  if (u.startsWith("kg") || u === "kilos" || u === "kilo") return "kg";
  if (u === "gr" || u === "g" || u === "gramo" || u === "gramos") return "kg";
  if (u === "l" || u === "lt" || u === "litro" || u === "litros") return "L";
  if (u === "ml" || u === "mls") return "L";
  if (u === "uni" || u === "ud" || u === "uds" || u === "unidad" || u === "unidades") return "ud";
  return raw?.toLowerCase() || "ud";
}

function cantidadACantidadKg(raw: unknown, unidadOriginal: string): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return null;
  const u = unidadOriginal.toLowerCase().trim();
  if (u === "gr" || u === "g" || u === "gramo" || u === "gramos") return n / 1000;
  if (u === "ml" || u === "mls") return n / 1000;
  return n;
}

interface Parsed {
  nombre: string;
  ingredientes: { nombre: string; unidad: string; cantidad: number }[];
}

function parseSheet(name: string, sheet: XLSX.WorkSheet): Parsed | null {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });

  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const r = rows[i] ?? [];
    const joined = r.map((c) => String(c).toUpperCase()).join("|");
    if (joined.includes("INGREDIENTES")) { headerRow = i; break; }
  }
  if (headerRow === -1) return null;

  const ingredientes: { nombre: string; unidad: string; cantidad: number }[] = [];
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const nombre = String(r[6] ?? "").trim();
    if (!nombre) {
      // allow one blank row then stop
      if (i === headerRow + 1) continue;
      // stop if we find a "RACIONES" label
      const left = String(r[0] ?? "").toUpperCase();
      if (left.includes("RACIONES")) break;
      continue;
    }
    const unidadRaw = String(r[9] ?? "").trim();
    const cantidad = cantidadACantidadKg(r[10], unidadRaw);
    if (cantidad === null || cantidad <= 0) continue;
    ingredientes.push({ nombre, unidad: normalizarUnidad(unidadRaw), cantidad });
  }

  if (ingredientes.length === 0) return null;

  return { nombre: name.trim(), ingredientes };
}

async function main() {
  console.log("🔌 Conectando a", process.env.NEXT_PUBLIC_SUPABASE_URL);

  const { data: emp } = await supabase.from("empresas").select("id").limit(1).single();
  if (!emp) throw new Error("No hay empresa");
  const empresaId = emp.id;

  const wb = XLSX.readFile(EXCEL);
  const parsed: Parsed[] = [];
  const saltadas: string[] = [];
  for (const name of wb.SheetNames) {
    const p = parseSheet(name, wb.Sheets[name]);
    if (p) parsed.push(p);
    else saltadas.push(name);
  }

  console.log(`\n📗 Excel: ${wb.SheetNames.length} hojas. Parseadas: ${parsed.length}. Saltadas: ${saltadas.length}`);
  if (saltadas.length > 0) console.log("  Saltadas:", saltadas.join(", "));

  // Borrar elaboraciones previas y sus escandallos
  const { data: prevElab } = await supabase
    .from("productos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("tipo", "elaboracion");
  if (prevElab && prevElab.length > 0) {
    const prevIds = prevElab.map((r) => r.id);
    await supabase.from("escandallos").delete().in("producto_venta_id", prevIds);
    await supabase.from("productos").delete().in("id", prevIds);
    console.log(`  🗑  Eliminadas ${prevElab.length} elaboraciones previas.`);
  }

  // Cargar todos los productos de compra para matching
  const { data: compras } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("tipo", "compra");
  const compraByNombre = new Map<string, string>();
  for (const c of compras ?? []) {
    compraByNombre.set(c.nombre.toLowerCase().trim(), c.id);
  }

  let totalEscandallos = 0;
  let nuevosIngredientes = 0;

  for (const elab of parsed) {
    // Crear producto tipo='elaboracion'
    const { data: prod, error: prodErr } = await supabase
      .from("productos")
      .insert({
        empresa_id: empresaId,
        tipo: "elaboracion",
        nombre: elab.nombre,
        categoria: "Salsas",
        estado: "Activo",
        unidad: "kg",
      })
      .select("id")
      .single();

    if (prodErr || !prod) {
      console.error(`  ❌ Falla creando "${elab.nombre}":`, prodErr?.message);
      continue;
    }

    // Resolver ingredientes
    const escRows: Array<{ producto_venta_id: string; ingrediente_id: string; cantidad: number; merma_pct: number }> = [];
    for (const ing of elab.ingredientes) {
      const key = ing.nombre.toLowerCase().trim();
      let ingId = compraByNombre.get(key);

      if (!ingId) {
        // Crear nuevo producto compra
        const { data: newProd, error: e } = await supabase
          .from("productos")
          .insert({
            empresa_id: empresaId,
            tipo: "compra",
            nombre: ing.nombre,
            categoria: "Sin categoría",
            estado: "Activo",
            unidad: ing.unidad,
          })
          .select("id")
          .single();
        if (e || !newProd) {
          console.error(`    ⚠ No pude crear ingrediente "${ing.nombre}":`, e?.message);
          continue;
        }
        ingId = newProd.id;
        compraByNombre.set(key, ingId);
        nuevosIngredientes++;
      }

      escRows.push({
        producto_venta_id: prod.id,
        ingrediente_id: ingId,
        cantidad: ing.cantidad,
        merma_pct: 0,
      });
    }

    if (escRows.length > 0) {
      const { error: escErr } = await supabase
        .from("escandallos")
        .upsert(escRows, { onConflict: "producto_venta_id,ingrediente_id" });
      if (escErr) console.error(`    ⚠ Escandallos falla ${elab.nombre}:`, escErr.message);
      else totalEscandallos += escRows.length;
    }

    console.log(`  ✓ ${elab.nombre} (${escRows.length} ingredientes)`);
  }

  console.log(`\n━━━ RESUMEN ━━━`);
  console.log(`  Elaboraciones creadas:     ${parsed.length}`);
  console.log(`  Escandallos (líneas):      ${totalEscandallos}`);
  console.log(`  Nuevos ingredientes compra: ${nuevosIngredientes}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
