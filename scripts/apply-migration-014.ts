/**
 * Aplica la migración 014: tabla productos_config (taxonomías dinámicas).
 * Uso: npx tsx scripts/apply-migration-014.ts
 */
import { createClient } from "@supabase/supabase-js";
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
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// Dividir el SQL en sentencias individuales para ejecutarlas una a una
const SQL_STATEMENTS = [
  `create table if not exists public.productos_config (
    id         uuid primary key default gen_random_uuid(),
    empresa_id uuid references public.empresas(id) on delete cascade,
    tipo       text not null check (tipo in ('compra', 'venta', 'elaboracion', 'global')),
    seccion    text not null check (seccion in ('categorias', 'familias', 'estados')),
    valores    text[] not null default '{}',
    updated_at timestamptz not null default now(),
    constraint uq_productos_config unique (empresa_id, tipo, seccion)
  )`,
  `create or replace function public.set_updated_at()
   returns trigger language plpgsql as $$
   begin new.updated_at = now(); return new; end; $$`,
  `drop trigger if exists trg_productos_config_updated_at on public.productos_config`,
  `create trigger trg_productos_config_updated_at
     before update on public.productos_config
     for each row execute function public.set_updated_at()`,
  `alter table public.productos_config enable row level security`,
  `do $$ begin
     if not exists (
       select 1 from pg_policies
       where tablename = 'productos_config' and policyname = 'empresa puede ver su config'
     ) then
       create policy "empresa puede ver su config"
         on public.productos_config for select
         using (empresa_id in (select empresa_id from public.profiles where user_id = auth.uid()));
     end if;
   end $$`,
  `do $$ begin
     if not exists (
       select 1 from pg_policies
       where tablename = 'productos_config' and policyname = 'empresa puede gestionar su config'
     ) then
       create policy "empresa puede gestionar su config"
         on public.productos_config for all
         using (empresa_id in (select empresa_id from public.profiles where user_id = auth.uid()))
         with check (empresa_id in (select empresa_id from public.profiles where user_id = auth.uid()));
     end if;
   end $$`,
];

async function main() {
  console.log("Aplicando migración 014 — productos_config...\n");

  for (const sql of SQL_STATEMENTS) {
    let result: { error: { message: string } | null };
    try {
      result = await supabase.rpc("exec_sql", { sql }) as { error: { message: string } | null };
    } catch {
      result = { error: { message: "exec_sql no disponible" } };
    }
    const { error } = result;
    if (error) {
      console.log("⚠️  exec_sql no disponible. Aplica la migración manualmente desde Supabase Studio > SQL Editor:");
      console.log("\n" + "─".repeat(60));
      const fullSql = fs.readFileSync(
        path.resolve(process.cwd(), "supabase/migrations/014_productos_config.sql"),
        "utf-8"
      );
      console.log(fullSql);
      console.log("─".repeat(60));
      console.log("\nURL del dashboard: https://supabase.com/dashboard/project/sxjtubzdpfmlmwqtsgro/sql");
      process.exit(0);
    }
    console.log("✓ OK:", sql.trim().split("\n")[0].slice(0, 60) + "…");
  }

  console.log("\n✅ Migración 014 aplicada correctamente.");
}

main();
