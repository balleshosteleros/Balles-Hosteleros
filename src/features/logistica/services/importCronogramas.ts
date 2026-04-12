import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

export interface CronogramaRow {
  rol: string;
  id_tarea?: string | number;
  formacion?: string;
  tarea: string;
  frecuencia: 'DIARIO' | 'SEMANAL' | 'MENSUAL' | 'TRIMESTRAL' | 'POR NECESIDAD' | 'OTRO';
  tiempo_requerido?: string;
}

/**
 * Normaliza las columnas para unificar los diferentes formatos de los excels.
 */
export function extractDataFromExcel(filePath: string, roleName: string): CronogramaRow[] {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Parseamos como array de arrays para buscar exactamente donde están las cabeceras reales "TAREAS"
  const rawData = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  let headerRowIndex = -1;
  let headers: string[] = [];
  
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row) continue;
    const stringRow = row.map(c => c != null ? String(c).trim().toUpperCase() : '');
    if (stringRow.includes('TAREAS') || stringRow.includes('TAREA')) {
      headerRowIndex = i;
      headers = stringRow;
      break;
    }
  }

  const extracted: CronogramaRow[] = [];
  if (headerRowIndex === -1) return extracted;

  for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const rowArray = rawData[i];
    if (!rowArray || rowArray.length === 0) continue;

    // Convertir array a map de headers
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      if (headers[j]) {
        row[headers[j]] = rowArray[j] != null ? String(rowArray[j]).trim() : '';
      }
    }

    const tareaDesc = row['TAREAS'] || row['TAREA'];
    if (!tareaDesc) continue;

    let frecuencia: CronogramaRow['frecuencia'] = 'OTRO';
    let tiempo = '';

    const checkFreq = (key: string, freqLabel: CronogramaRow['frecuencia']) => {
       if (row[key] && row[key] !== '') {
          frecuencia = freqLabel;
          tiempo = row[key];
       }
    };

    // Al revés para mantener especificidad u orden si hay cruces
    checkFreq('POR NECESIDAD', 'POR NECESIDAD');
    checkFreq('TRIMESTRAL', 'TRIMESTRAL');
    checkFreq('MENSUAL', 'MENSUAL');
    checkFreq('SEMANAL', 'SEMANAL');
    checkFreq('DIARIO', 'DIARIO');

    extracted.push({
      rol: roleName,
      id_tarea: row['ID'] || '',
      formacion: row['FORMACION'] || '',
      tarea: tareaDesc,
      frecuencia,
      tiempo_requerido: tiempo !== '-' && tiempo.toUpperCase() !== 'X' && tiempo ? tiempo : undefined,
    });
  }

  return extracted;
}

export async function importarCronogramas() {
  const cronogramasDir = path.join(process.cwd(), '..', 'Cronogramas');
  
  if (!fs.existsSync(cronogramasDir)) {
    console.error(`❌ El directorio ${cronogramasDir} no existe.`);
    return;
  }

  const files = fs.readdirSync(cronogramasDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));
  
  console.log(`\n🔍 Auditoría: Se han encontrado ${files.length} archivos para procesar.\n`);

  let allTareas: CronogramaRow[] = [];

  // Fase de Lectura y Mapeo
  for (const file of files) {
    const roleName = path.basename(file, '.xlsx').trim();
    const filePath = path.join(cronogramasDir, file);
    
    try {
      const data = extractDataFromExcel(filePath, roleName);
      console.log(`✅ ${file}: ${data.length} tareas extraídas.`);
      allTareas = [...allTareas, ...data];
    } catch (error) {
      console.error(`❌ Error procesando ${file}:`, error);
    }
  }

  // Validación: Log de los datos antes de la inserción real
  console.log('\n=======================================');
  console.log('📋 VALIDACIÓN DE DATOS (MUESTRA PREVIA)');
  console.log('=======================================');
  console.table(allTareas.slice(0, 10)); // Muestra las primeras 10 como log
  console.log(`\nTotal general de tareas a insertar: ${allTareas.length}`);
  
  // CLIENTE DE SUPABASE
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) {
    console.error("❌ Faltan las variables de entorno de Supabase (.env.local)");
    return;
  }
  
  const supabase = createClient(sbUrl, sbKey);
  console.log(`\n⏳ Inyectando ${allTareas.length} registros en Supabase...`);

  // Particionar para evitar limite de payload si fuera muy grande
  const CHUNK_SIZE = 100;
  for (let i = 0; i < allTareas.length; i += CHUNK_SIZE) {
    const chunk = allTareas.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('cronogramas_operativos').insert(chunk);
    if (error) {
       console.error(`❌ Error insertando bloque ${i}:`, error.message);
       // Podría fallar si falta la migración
       if (error.code === '42P01') {
         console.error('>> ¡PISTA! La tabla cronogramas_operativos NO EXISTE. Debes ejecutar la migración 002_cronogramas_operativos.sql en Supabase primero.');
         return;
       }
    } else {
       console.log(`✅ Bloque ${i / CHUNK_SIZE + 1} insertado con éxito.`);
    }
  }
  
  console.log('\n🚀 Datos inyectados en Supabase (cronogramas_operativos).');
}

// Para poder ejecutarlo directamente desde consola (ej: npx tsx src/features/logistica/services/importCronogramas.ts)
if (require.main === module) {
  importarCronogramas();
}
