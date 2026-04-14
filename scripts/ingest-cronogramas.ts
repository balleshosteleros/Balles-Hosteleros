/**
 * Ingest de los 9 cronogramas desde /Users/ivanballesteros/Desktop/SAAS/Cronogramas/*.xlsx
 *
 * Estructura común (la mayoría):
 *   row 0: título "CRONOGRAMA <ROL>"
 *   row 1: header [ID, VIDEOS/FORMACION, TAREAS, <freq>, <freq>, ...]
 *   row 2+: filas de datos
 *
 * Reglas jerarquía:
 *   - ID entero (1,2,3) = tarea principal
 *   - ID decimal (1.1, 2.3) = subtarea de la principal con ese mismo entero
 *   - sin ID (o con prefijo -- / - en la tarea) = subtarea de la última principal
 *   - una subtarea NUNCA tiene sub-subtareas
 *
 * DIRECCION.xlsx tiene formato calendario distinto — se trata aparte: cada fila
 * es una tarea principal sin subtareas; la frecuencia se infiere por columna
 * "POR NECESIDAD" si está marcada, si no MENSUAL.
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

const DIR = "/Users/ivanballesteros/Desktop/SAAS/Cronogramas";

const VALID_FREQ = ["DIARIO", "SEMANAL", "MENSUAL", "TRIMESTRAL", "ANUAL", "POR NECESIDAD"];

interface Tarea {
  rol: string;
  idVisible: string | null;
  tarea: string;
  frecuencia: string;
  tiempoRequerido: string;
  parentTempId: string | null; // referencia temporal (id_visible del padre)
  tempId: string;
  orden: number;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function isMainId(id: string): boolean {
  return /^\d+$/.test(id);
}

function isSubId(id: string): boolean {
  return /^\d+\.\d+$/.test(id);
}

function parentOf(subId: string): string {
  return subId.split(".")[0];
}

function parseStandardSheet(rolName: string, sheetName: string, rows: unknown[][]): Tarea[] {
  // Buscar fila de cabecera
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const r = (rows[i] ?? []).map((c) => str(c).toUpperCase());
    if (r.some((c) => c === "TAREAS" || c === "TAREA")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const header = (rows[headerIdx] ?? []).map((c) => str(c).toUpperCase());
  const idCol = header.indexOf("ID"); // puede ser -1
  const tareaCol = header.findIndex((c) => c === "TAREAS" || c === "TAREA");
  if (tareaCol === -1) return [];
  const freqCols: { idx: number; name: string }[] = [];
  header.forEach((c, idx) => {
    if (VALID_FREQ.includes(c)) freqCols.push({ idx, name: c });
  });

  const tareas: Tarea[] = [];
  let lastMainId: string | null = null;
  let orden = 0;

  let autoMain = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const idRaw = idCol >= 0 ? str(r[idCol]) : "";
    const tareaText = str(r[tareaCol]);
    if (!tareaText) continue;

    // Limpiar prefijos -- y - de subtareas
    const tareaLimpia = tareaText.replace(/^[-]+\s*/, "").trim();
    if (!tareaLimpia) continue;

    // Determinar frecuencia
    let frecuencia = "OTRO";
    let tiempo = "";
    for (const fc of freqCols) {
      const val = str(r[fc.idx]);
      if (val) { frecuencia = fc.name; tiempo = val; break; }
    }

    let idVis: string | null = null;
    let parentTemp: string | null = null;

    if (idRaw && isMainId(idRaw)) {
      idVis = idRaw;
      lastMainId = idRaw;
    } else if (idRaw && isSubId(idRaw)) {
      idVis = idRaw;
      parentTemp = parentOf(idRaw);
    } else {
      // Sin ID o ID texto → subtarea de la última principal, salvo que no haya ninguna
      // (en cuyo caso, si la hoja no tiene IDs, tratamos cada fila como tarea principal)
      if (idCol === -1) {
        autoMain++;
        idVis = String(autoMain);
        lastMainId = idVis;
      } else if (lastMainId) {
        parentTemp = lastMainId;
      } else {
        continue;
      }
    }

    tareas.push({
      rol: rolName,
      idVisible: idVis,
      tarea: tareaLimpia,
      frecuencia,
      tiempoRequerido: tiempo,
      parentTempId: parentTemp,
      tempId: `${rolName}::${idRaw || `auto-${i}`}::${i}`,
      orden: orden++,
    });
  }

  return tareas;
}

function parseDireccionSheet(rolName: string, _sheetName: string, rows: unknown[][]): Tarea[] {
  // formato calendario: row 0/1 son cabeceras, row 2+ son tareas con true/false por mes
  const tareas: Tarea[] = [];
  let orden = 0;
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const tareaText = str(r[0]);
    if (!tareaText) continue;
    if (tareaText.toUpperCase().includes("CRONOGRAMA") || tareaText.toUpperCase() === "TAREAS") continue;
    if (tareaText.toUpperCase().includes("ESPECIFICAS DE")) continue;

    // Si la columna check-list (col 1) contiene "POR NECESIDAD" → frecuencia por necesidad
    const checkList = str(r[1]).toUpperCase();
    let frecuencia = "MENSUAL";
    let tiempo = "";
    if (checkList.includes("POR NECESIDAD")) {
      frecuencia = "POR NECESIDAD";
      tiempo = "POR NECESIDAD";
    } else {
      // Contar trues — si más de la mitad de meses → MENSUAL
      let trues = 0;
      for (let j = 2; j < r.length; j++) if (str(r[j]).toLowerCase() === "true") trues++;
      if (trues === 0) continue; // tarea sin marca, ignorar
      frecuencia = "MENSUAL";
    }

    tareas.push({
      rol: rolName,
      idVisible: String(orden + 1),
      tarea: tareaText,
      frecuencia,
      tiempoRequerido: tiempo,
      parentTempId: null,
      tempId: `${rolName}::dir::${i}`,
      orden: orden++,
    });
  }
  return tareas;
}

const FILES: { file: string; rol: string }[] = [
  { file: "CALIDAD .xlsx", rol: "CALIDAD" },
  { file: "CONTABILIDAD .xlsx", rol: "CONTABILIDAD" },
  { file: "DIRECCION .xlsx", rol: "DIRECCION" },
  { file: "GERENTE.xlsx", rol: "GERENTE" },
  { file: "JEFE DE COCINA.xlsx", rol: "JEFE DE COCINA" },
  { file: "JEFE DE SALA .xlsx", rol: "JEFE DE SALA" },
  { file: "LOGISTICA .xlsx", rol: "LOGISTICA" },
  { file: "MARKETING .xlsx", rol: "MARKETING" },
  { file: "RECURSOS HUMANOS .xlsx", rol: "RECURSOS HUMANOS" },
];

async function main() {
  console.log("🧹 Borrando cronogramas existentes...");
  await supabase.from("cronogramas_operativos").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const allTareas: Tarea[] = [];

  for (const { file, rol } of FILES) {
    const fp = path.join(DIR, file);
    if (!fs.existsSync(fp)) { console.log(`  ⚠ No existe: ${file}`); continue; }
    const wb = XLSX.readFile(fp);
    let count = 0;
    for (const sheetName of wb.SheetNames) {
      const lower = sheetName.toLowerCase();
      if (!lower.includes("cronograma")) continue; // skip FORMACION, CONDICIONES, etc.

      const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: true });
      const parsed = rol === "DIRECCION"
        ? parseDireccionSheet(rol, sheetName, rows)
        : parseStandardSheet(rol, sheetName, rows);
      allTareas.push(...parsed);
      count += parsed.length;
    }
    console.log(`  ✓ ${rol}: ${count} tareas`);
  }

  // Primera pasada: insertar tareas principales (parentTempId === null)
  const tempIdToDbId = new Map<string, string>();
  const principales = allTareas.filter((t) => !t.parentTempId);
  console.log(`\n📥 Insertando ${principales.length} tareas principales...`);

  for (const t of principales) {
    const { data, error } = await supabase
      .from("cronogramas_operativos")
      .insert({
        rol: t.rol,
        tarea: t.tarea,
        frecuencia: t.frecuencia,
        tiempo_requerido: t.tiempoRequerido || null,
        id_visible: t.idVisible,
        orden: t.orden,
      })
      .select("id")
      .single();
    if (error) { console.error(`  ⚠`, error.message); continue; }
    tempIdToDbId.set(t.tempId, data.id);
    // También indexar por (rol, idVisible) para resolver subtareas que apuntan por número
    if (t.idVisible) tempIdToDbId.set(`${t.rol}::idvis::${t.idVisible}`, data.id);
  }

  // Segunda pasada: subtareas
  const subs = allTareas.filter((t) => t.parentTempId);
  console.log(`📥 Insertando ${subs.length} subtareas...`);

  for (const t of subs) {
    const parentDbId = tempIdToDbId.get(`${t.rol}::idvis::${t.parentTempId}`);
    if (!parentDbId) {
      console.warn(`  ⚠ Sin padre para "${t.tarea}" (rol=${t.rol}, parent=${t.parentTempId})`);
    }
    const { error } = await supabase
      .from("cronogramas_operativos")
      .insert({
        rol: t.rol,
        tarea: t.tarea,
        frecuencia: t.frecuencia,
        tiempo_requerido: t.tiempoRequerido || null,
        id_visible: t.idVisible,
        parent_id: parentDbId ?? null,
        orden: t.orden,
      });
    if (error) console.error(`  ⚠`, error.message);
  }

  const { count } = await supabase
    .from("cronogramas_operativos").select("id", { count: "exact", head: true });
  console.log(`\n✓ Total filas en BD: ${count}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
