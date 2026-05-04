/**
 * Seed de empresa DEMO para inversores.
 * URL pública: https://demo.balleshosteleros.com (auto-login, solo lectura)
 *
 * Uso: npx tsx scripts/seed-demo.ts
 * Idempotente — borra y recrea todo.
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// --- Cargar .env.local ---
const envPath = path.resolve(process.cwd(), ".env.local");
const content = fs.readFileSync(envPath, "utf-8");
for (const line of content.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// --- Constantes DEMO ---
export const DEMO_EMPRESA_ID = "d3b0aaaa-0000-0000-0000-000000000001";
export const DEMO_EMAIL = "demo@balleshosteleros.com";
export const DEMO_PASSWORD = "DemoInversores2026!";
const DEMO_EMPRESA_NOMBRE = "Bacanal Tapas Demo";

// --- Utils ---
const u = (n: number) => `d3b0${String(n).padStart(4, "0")}-0000-0000-0000-000000000000`;
const emp = (n: number) => `d3b0aaaa-0001-0000-0000-${String(n).padStart(12, "0")}`;
const prod = (n: number) => `d3b0aaaa-0002-0000-0000-${String(n).padStart(12, "0")}`;
const prov = (n: number) => `d3b0aaaa-0003-0000-0000-${String(n).padStart(12, "0")}`;
const tk = (n: number) => `d3b0aaaa-0004-0000-0000-${String(n).padStart(12, "0")}`;

function iso(d: Date) { return d.toISOString(); }
function dateOnly(d: Date) { return d.toISOString().slice(0, 10); }

const NOMBRES = [
  ["Carmen", "Ruiz Álvarez"], ["David", "Martín Gómez"], ["Laura", "Sánchez Pérez"],
  ["Andrés", "López Ortega"], ["Inés", "Fernández Prieto"], ["Javier", "Moreno Castro"],
  ["Marta", "Díaz Romero"], ["Pablo", "Navarro Iglesias"],
];

const PUESTOS = ["Jefe de cocina", "Cocinero", "Ayudante cocina", "Camarero jefe", "Camarero", "Camarero", "Encargada de sala", "Office"];

const PROVEEDORES = [
  { nombre: "Makro España", categoria: "Alimentación general" },
  { nombre: "Mercamadrid Frutas", categoria: "Frutas y verduras" },
  { nombre: "Coca-Cola Iberia", categoria: "Bebidas" },
  { nombre: "Pescados Hermanos Ruiz", categoria: "Pescadería" },
];

const PRODUCTOS_COMPRA = [
  { nombre: "Tomate pera", categoria: "Verduras", precio: 1.8 },
  { nombre: "Aceite oliva virgen extra 5L", categoria: "Aceites", precio: 42 },
  { nombre: "Jamón serrano pieza", categoria: "Charcutería", precio: 85 },
  { nombre: "Bacalao desalado 1kg", categoria: "Pescadería", precio: 18 },
  { nombre: "Harina trigo 5kg", categoria: "Harinas", precio: 6.5 },
  { nombre: "Huevos docena XL", categoria: "Huevos", precio: 3.2 },
  { nombre: "Patata agria 25kg", categoria: "Verduras", precio: 18 },
  { nombre: "Cebolla blanca 10kg", categoria: "Verduras", precio: 7.5 },
  { nombre: "Atún claro lata 900g", categoria: "Conservas", precio: 9.5 },
  { nombre: "Vino blanco verdejo caja", categoria: "Bebidas", precio: 48 },
  { nombre: "Coca-Cola botellín 24u", categoria: "Bebidas", precio: 18 },
  { nombre: "Cerveza Mahou barril 30L", categoria: "Bebidas", precio: 85 },
  { nombre: "Leche entera 6L", categoria: "Lácteos", precio: 5.4 },
  { nombre: "Queso manchego cuña", categoria: "Charcutería", precio: 14 },
  { nombre: "Pan de masa madre", categoria: "Panadería", precio: 1.2 },
];

const PLATOS = [
  { nombre: "Croquetas caseras de jamón (8u)", pvp: 9.5 },
  { nombre: "Ensaladilla de la casa", pvp: 8.0 },
  { nombre: "Tortilla española", pvp: 7.5 },
  { nombre: "Patatas bravas", pvp: 6.5 },
  { nombre: "Calamares a la andaluza", pvp: 12 },
  { nombre: "Gazpacho andaluz", pvp: 5.5 },
];

async function log(step: string) {
  console.log(`\n▶ ${step}`);
}

async function main() {
  console.log(`\n🌱 Seed DEMO para ${DEMO_EMPRESA_NOMBRE}`);
  console.log(`   empresa_id: ${DEMO_EMPRESA_ID}`);
  console.log(`   usuario:    ${DEMO_EMAIL}\n`);

  // ---- 1) CLEANUP previo (idempotente) ----
  await log("1/11 Limpieza de datos demo previos");
  // Ojo al orden: primero hijos, luego padres
  const tablas = [
    "pos_pagos", "pos_ticket_lineas", "pos_tickets", "pos_sesiones_caja",
    "mermas", "fichas_tecnicas", "ingredientes_proveedor",
    "nominas", "contratos", "empleados",
    "productos", "proveedores",
    "aperturas", "campanas_marketing",
    "user_roles", "profiles",
  ];
  for (const t of tablas) {
    // user_roles: filtrar por user del demo (se borrará después junto al auth user)
    if (t === "user_roles" || t === "profiles") continue;
    const { error } = await sb.from(t).delete().eq("empresa_id", DEMO_EMPRESA_ID);
    if (error && !error.message.includes("does not exist")) {
      console.log(`   ⚠️  ${t}: ${error.message}`);
    }
  }

  // Borrar user auth demo previo (si existe)
  const { data: existingUsers } = await sb.auth.admin.listUsers();
  const prev = existingUsers?.users.find((u) => u.email === DEMO_EMAIL);
  if (prev) {
    await sb.from("user_roles").delete().eq("user_id", prev.id);
    await sb.from("profiles").delete().eq("user_id", prev.id);
    await sb.auth.admin.deleteUser(prev.id);
    console.log(`   🗑  user auth demo previo eliminado`);
  }

  // Borrar empresa demo previa
  await sb.from("empresas").delete().eq("id", DEMO_EMPRESA_ID);

  // ---- 2) Empresa ----
  await log("2/11 Creando empresa demo");
  const { error: eEmp } = await sb.from("empresas").insert({
    id: DEMO_EMPRESA_ID,
    nombre: DEMO_EMPRESA_NOMBRE,
  });
  if (eEmp) throw new Error(`empresa: ${eEmp.message}`);

  // ---- 3) Usuario auth + profile + rol ----
  await log("3/11 Creando usuario auth demo");
  const { data: userData, error: eUser } = await sb.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { nombre: "Inversor Demo" },
  });
  if (eUser) throw new Error(`auth user: ${eUser.message}`);
  const userId = userData.user!.id;

  // El trigger handle_new_user ya crea el profile con id=user_id. Hacemos UPDATE.
  const { error: eProf } = await sb
    .from("profiles")
    .update({
      user_id: userId,
      nombre: "Inversor",
      apellidos: "Demo",
      empresa_id: DEMO_EMPRESA_ID,
    })
    .eq("id", userId);
  if (eProf) throw new Error(`profile: ${eProf.message}`);

  const { error: eRol } = await sb.from("user_roles").insert({
    user_id: userId,
    role: "director",
  });
  if (eRol) throw new Error(`user_roles: ${eRol.message}`);

  // ---- 4) Empleados + contratos + nóminas ----
  await log("4/11 Poblando RRHH (8 empleados + nóminas)");
  const empleadosRows = NOMBRES.map(([n, ap], i) => ({
    id: emp(i + 1),
    empresa_id: DEMO_EMPRESA_ID,
    nombre: `${n} ${ap}`,
    fecha_alta: "2024-01-15",
    estado: "Activo",
  }));
  const { error: eEmps } = await sb.from("empleados").insert(empleadosRows);
  if (eEmps) console.log(`   ⚠️  empleados: ${eEmps.message}`);

  const contratosRows = empleadosRows.map((e, i) => ({
    empresa_id: DEMO_EMPRESA_ID,
    empleado_id: e.id,
    tipo: i < 6 ? "Indefinido" : "Temporal",
    fecha_inicio: "2024-01-15",
    salario_bruto: i === 0 ? 2800 : i < 3 ? 1900 : 1450,
  }));
  const { error: eCtr } = await sb.from("contratos").insert(contratosRows);
  if (eCtr) console.log(`   ⚠️  contratos: ${eCtr.message}`);

  const nominasRows = empleadosRows.map((e, i) => ({
    empresa_id: DEMO_EMPRESA_ID,
    empleado_id: e.id,
    periodo: "2026-03",
    salario_base: i === 0 ? 2800 : i < 3 ? 1900 : 1450,
  }));
  const { error: eNom } = await sb.from("nominas").insert(nominasRows);
  if (eNom) console.log(`   ⚠️  nominas: ${eNom.message}`);

  // ---- 5) Proveedores ----
  await log("5/11 Poblando proveedores");
  const provRows = PROVEEDORES.map((p, i) => ({
    id: prov(i + 1),
    empresa_id: DEMO_EMPRESA_ID,
    nombre_comercial: p.nombre,
    categoria: p.categoria,
    estado: "Activo",
  }));
  const { error: eProv } = await sb.from("proveedores").insert(provRows);
  if (eProv) console.log(`   ⚠️  proveedores: ${eProv.message}`);

  // ---- 6) Productos compra ----
  await log("6/11 Poblando productos");
  const productosRows = PRODUCTOS_COMPRA.map((p, i) => ({
    id: prod(i + 1),
    empresa_id: DEMO_EMPRESA_ID,
    nombre: p.nombre,
    tipo: "compra" as const,
    categoria: p.categoria,
  }));
  const { error: ePr } = await sb.from("productos").insert(productosRows);
  if (ePr) console.log(`   ⚠️  productos: ${ePr.message}`);

  // ---- 7) Link productos-proveedores ----
  await log("7/11 Vinculando productos-proveedores");
  const ingProvRows = PRODUCTOS_COMPRA.map((p, i) => ({
    producto_id: prod(i + 1),
    proveedor_id: prov((i % 4) + 1),
    precio_unitario: p.precio,
  }));
  const { error: eIP } = await sb.from("ingredientes_proveedor").insert(ingProvRows);
  if (eIP) console.log(`   ⚠️  ingredientes_proveedor: ${eIP.message}`);

  // ---- 8) Fichas técnicas (platos) ----
  await log("8/11 Poblando fichas técnicas (platos)");
  const fichasRows = PLATOS.map((p, i) => ({
    id: u(100 + i),
    empresa_id: DEMO_EMPRESA_ID,
    nombre: p.nombre,
    estado: "Activa",
  }));
  const { error: eFT } = await sb.from("fichas_tecnicas").insert(fichasRows);
  if (eFT) console.log(`   ⚠️  fichas_tecnicas: ${eFT.message}`);

  // ---- 9) Mermas ----
  await log("9/11 Poblando mermas");
  const mermasRows = [
    { empresa_id: DEMO_EMPRESA_ID, producto_id: prod(1), cantidad: 2.5, motivo: "Caducidad", fecha: "2026-04-10" },
    { empresa_id: DEMO_EMPRESA_ID, producto_id: prod(3), cantidad: 0.8, motivo: "Elaboracion", fecha: "2026-04-12" },
    { empresa_id: DEMO_EMPRESA_ID, producto_id: prod(7), cantidad: 3.0, motivo: "Mal estado", fecha: "2026-04-15" },
  ];
  const { error: eM } = await sb.from("mermas").insert(mermasRows);
  if (eM) console.log(`   ⚠️  mermas: ${eM.message}`);

  // ---- 10) POS: sesiones + tickets + líneas + pagos ----
  await log("10/11 Poblando POS (3 sesiones, ~40 tickets, 4.200€)");
  const sesiones = [
    { id: u(200), fecha: "2026-04-15" },
    { id: u(201), fecha: "2026-04-17" },
    { id: u(202), fecha: "2026-04-18" },
  ];
  const sesionesRows = sesiones.map((s) => ({
    id: s.id,
    empresa_id: DEMO_EMPRESA_ID,
    fondo_inicial: 150,
    estado: "CERRADA",
    abierta_at: `${s.fecha}T12:00:00Z`,
    cerrada_at: `${s.fecha}T23:30:00Z`,
  }));
  const { error: eSC } = await sb.from("pos_sesiones_caja").insert(sesionesRows);
  if (eSC) console.log(`   ⚠️  pos_sesiones_caja: ${eSC.message}`);

  // 40 tickets repartidos en 3 sesiones
  const ticketsRows: Array<Record<string, unknown>> = [];
  const lineasRows: Array<Record<string, unknown>> = [];
  const pagosRows: Array<Record<string, unknown>> = [];
  let totalFact = 0;
  let ticketNum = 1;
  for (let s = 0; s < sesiones.length; s++) {
    const nTickets = [12, 14, 14][s];
    for (let i = 0; i < nTickets; i++) {
      const tkId = tk(ticketNum);
      const nLineas = 2 + (i % 3); // 2, 3 o 4 platos por ticket
      let subtotal = 0;
      const lineasTicket: Array<Record<string, unknown>> = [];
      for (let l = 0; l < nLineas; l++) {
        const plato = PLATOS[(ticketNum + l) % PLATOS.length];
        const cant = 1 + ((l + i) % 2);
        const importe = plato.pvp * cant;
        subtotal += importe;
        lineasTicket.push({
          ticket_id: tkId,
          nombre: plato.nombre,
          cantidad: cant,
          precio_unitario: plato.pvp,
        });
      }
      lineasRows.push(...lineasTicket);
      totalFact += subtotal;
      ticketsRows.push({
        id: tkId,
        empresa_id: DEMO_EMPRESA_ID,
        numero: `T-2604-${String(ticketNum).padStart(4, "0")}`,
        sesion_caja_id: sesiones[s].id,
        estado: "COBRADO",
        total: subtotal.toFixed(2),
        created_at: `${sesiones[s].fecha}T${String(13 + (i % 10)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00Z`,
      });
      pagosRows.push({
        ticket_id: tkId,
        medio: i % 3 === 0 ? "EFECTIVO" : "TARJETA",
        importe: subtotal.toFixed(2),
      });
      ticketNum++;
    }
  }
  // Insertar en lotes
  const { error: eTk } = await sb.from("pos_tickets").insert(ticketsRows);
  if (eTk) console.log(`   ⚠️  pos_tickets: ${eTk.message}`);
  const { error: eLn } = await sb.from("pos_ticket_lineas").insert(lineasRows);
  if (eLn) console.log(`   ⚠️  pos_ticket_lineas: ${eLn.message}`);
  const { error: ePg } = await sb.from("pos_pagos").insert(pagosRows);
  if (ePg) console.log(`   ⚠️  pos_pagos: ${ePg.message}`);
  console.log(`   💰 Facturación simulada: ${totalFact.toFixed(2)} €`);

  // ---- 11) Dirección + Marketing ----
  await log("11/11 Poblando aperturas + campañas marketing");
  await sb.from("aperturas").insert([
    { empresa_id: DEMO_EMPRESA_ID, fecha: "2026-04-18", turno: "Mañana", estado: "Activa" },
    { empresa_id: DEMO_EMPRESA_ID, fecha: "2026-04-19", turno: "Mañana", estado: "Activa" },
  ]);
  await sb.from("campanas_marketing").insert([
    { empresa_id: DEMO_EMPRESA_ID, canal: "email", nombre: "Menú Semana Santa", estado: "enviada" },
    { empresa_id: DEMO_EMPRESA_ID, canal: "email", nombre: "Promoción Día de la Madre", estado: "borrador" },
  ]);

  console.log(`\n✅ Seed DEMO completo.`);
  console.log(`   URL:        https://demo.balleshosteleros.com`);
  console.log(`   Usuario:    ${DEMO_EMAIL}`);
  console.log(`   Password:   ${DEMO_PASSWORD}`);
  console.log(`   Empresa:    ${DEMO_EMPRESA_NOMBRE} (${DEMO_EMPRESA_ID})\n`);
}

main().catch((err) => {
  console.error("\n❌ ERROR:", err);
  process.exit(1);
});
