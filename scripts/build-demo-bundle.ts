/**
 * Genera supabase/migrations/_DEMO_BUNDLE.sql con todas las migraciones
 * que faltan por aplicar en producción, concatenadas en orden.
 *
 * Uso: npx tsx scripts/build-demo-bundle.ts
 */
import * as fs from "fs";
import * as path from "path";

const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
const outPath = path.resolve(migrationsDir, "_DEMO_BUNDLE.sql");

// Inclusivo: metemos TODAS las migraciones desde 001.
// Son idempotentes (if not exists, on conflict) — las ya aplicadas se saltan.
// Evita problemas de dependencias ocultas (ej: 027 depende de 009.reservas).
const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => /^\d{3}_.+\.sql$/.test(f))
  .sort();

const missing = files;

console.log(`Total migraciones: ${files.length}`);
console.log(`Ya aplicadas: ${files.length - missing.length}`);
console.log(`A aplicar: ${missing.length}`);
console.log(`Archivos a concatenar:\n  ${missing.join("\n  ")}\n`);

const header = `-- ============================================================
-- DEMO BUNDLE — Migraciones pendientes consolidadas
-- Generado: ${new Date().toISOString()}
--
-- INSTRUCCIONES:
--   1. Abre Supabase Dashboard → SQL Editor → New query
--   2. Pega TODO este archivo
--   3. Click en Run
--   4. Espera a "Success" (puede tardar 10-30 seg)
--
-- Es IDEMPOTENTE: usa 'if not exists' en todas las creaciones.
-- Si una tabla ya existe, la migración la salta sin romper.
-- ============================================================

-- ── FIX PREVIO: constraints que las migraciones 026+ asumen ──
-- profiles.user_id debe ser UNIQUE (para que otras tablas puedan hacer FK a él).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_user_id_unique'
      and conrelid = 'public.profiles'::regclass
  ) then
    -- Eliminar duplicados en user_id primero (mantiene el más antiguo)
    delete from public.profiles p1
    using public.profiles p2
    where p1.user_id = p2.user_id
      and p1.created_at > p2.created_at;

    alter table public.profiles
      add constraint profiles_user_id_unique unique (user_id);
  end if;
end $$;

-- Asegurar permisos de schema para service_role (necesario para seed)
grant usage on schema public to service_role, authenticated, anon;
alter default privileges in schema public grant all on tables to service_role, authenticated;
alter default privileges in schema public grant all on sequences to service_role, authenticated;

`;

// Transforma `create policy if not exists "X" on Y ...`
// → `drop policy if exists "X" on Y; create policy "X" on Y ...`
// (PostgreSQL no soporta IF NOT EXISTS en CREATE POLICY).
// PostgreSQL no soporta IF NOT EXISTS en CREATE TYPE. Envolvemos en DO $$...EXCEPTION.
function patchCreateType(sql: string): string {
  // Match: create type if not exists NOMBRE as enum (...);
  return sql.replace(
    /^create type if not exists\s+([\w.]+)\s+as\s+(enum\s*\([^)]*\));/gim,
    (_m, name, body) =>
      `do $$ begin\n  create type ${name} as ${body};\nexception when duplicate_object then null;\nend $$;`,
  );
}

function patchCreatePolicy(sql: string): string {
  // Caso 1: "create policy if not exists \"X\" on Y" en la misma línea
  let out = sql.replace(
    /^create policy if not exists "([^"]+)" on ([\w.]+)/gim,
    (_m, name, tbl) => `drop policy if exists "${name}" on ${tbl};\ncreate policy "${name}" on ${tbl}`,
  );
  // Caso 2: "create policy if not exists \"X\"" y en LÍNEA SIGUIENTE "on Y"
  out = out.replace(
    /^create policy if not exists "([^"]+)"\s*\n\s*on\s+([\w.]+)/gim,
    (_m, name, tbl) => `drop policy if exists "${name}" on ${tbl};\ncreate policy "${name}"\n  on ${tbl}`,
  );
  return out;
}

const body = missing
  .map((f) => {
    const sep = "-- " + "=".repeat(56);
    const raw = fs.readFileSync(path.join(migrationsDir, f), "utf-8");
    const content = patchCreatePolicy(patchCreateType(raw));
    return `${sep}\n-- ARCHIVO: ${f}\n${sep}\n\n${content}`;
  })
  .join("\n\n");

const footer = `\n\n-- ============================================================
-- FIN DEL BUNDLE — refresca PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
`;

fs.writeFileSync(outPath, header + body + footer);
const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`\n✅ Generado: ${outPath}`);
console.log(`   Tamaño: ${sizeKb} KB`);
console.log(`\nProximo paso: abre el archivo y copia su contenido al SQL Editor.`);
