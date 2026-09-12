/**
 * Carga el uniforme y el material que ya tiene puesto cada trabajador de HABANA
 * y BACANAL, y le manda a cada uno su acta para que la firme.
 *
 * Este inventario no estaba en ningún sistema: vivía en una lista dictada. Al
 * cargarlo se tramita como si se entregara hoy de nuevas — cada pieza es una
 * entrega con su acta y su firma — porque la firma es lo único que acredita que
 * el trabajador reconoce tener esa pieza, y ninguna de estas se firmó nunca.
 *
 * Uso:
 *   npx tsx scripts/cargar-entregas-habana-bacanal.ts
 *   npx tsx scripts/cargar-entregas-habana-bacanal.ts --aplicar
 *
 * Sin `--aplicar` no escribe nada ni manda ningún correo: valida los datos
 * contra el catálogo, cuenta qué haría y dice a quién le llegaría qué. Con 32
 * correos a 12 personas reales delante, mirar antes no es un lujo.
 *
 * CUADRICULADO A PROPÓSITO: los nombres de aquí abajo tienen que existir tal
 * cual en el catálogo de su empresa, y las tallas tienen que estar en el abanico
 * de tallas del sistema. Si algo no cuadra, el script ABORTA sin escribir nada
 * en vez de inventarse un tipo o colar una talla que no existe.
 *
 * Repetible: cuenta lo que ya hay grabado de cada pieza y solo crea lo que
 * falta, así que ejecutarlo dos veces no duplica entregas ni reenvía actas.
 */

import { readFileSync } from "node:fs";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarActaEntregaAFirma } from "@/features/rrhh/services/entregas/enviar-a-firma";
import { TALLAS_ROPA } from "@/features/rrhh/data/entregas";

/**
 * El entorno vive en `.env.local`, que Next carga solo, pero un script no. Se
 * puebla antes de llamar a nada que use el cliente de Supabase.
 */
function cargarEnv(): void {
  const txt = readFileSync(".env.local", "utf8");
  for (const linea of txt.split("\n")) {
    if (!linea.includes("=") || linea.trimStart().startsWith("#")) continue;
    const i = linea.indexOf("=");
    const clave = linea.slice(0, i).trim();
    if (process.env[clave]) continue;
    process.env[clave] = linea.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
cargarEnv();

const APLICAR = process.argv.includes("--aplicar");

/** Quién figura como responsable de la entrega. */
const EMAIL_RRHH = "direccion.grupohabana@gmail.com";

interface PiezaACargar {
  /** Nombre EXACTO del tipo en el catálogo de la empresa. */
  tipo: string;
  /** Talla del abanico del sistema, o null si el tipo no lleva talla. */
  talla: string | null;
  /** Cuántas unidades iguales tiene. Cada una será su propia entrega. */
  unidades?: number;
  /** Texto que se guarda en la entrega y sale en el acta. */
  nota?: string;
}

interface EmpleadoACargar {
  nombre: string;
  apellidos: string;
  piezas: PiezaACargar[];
}

const CARGA: Record<string, EmpleadoACargar[]> = {
  HABANA: [
    {
      nombre: "Javier",
      apellidos: "Casarrubios Muñoz",
      piezas: [{ tipo: "Camisa manga corta", talla: "M" }],
    },
    {
      nombre: "Mireya",
      apellidos: "Tejedor Magariño",
      piezas: [
        { tipo: "Camisa manga corta", talla: "S" },
        { tipo: "Camisa manga larga", talla: "S" },
        { tipo: "Llaves del local", talla: null, nota: "Jefe de sala" },
      ],
    },
    {
      nombre: "Diego Rodrigo",
      apellidos: "Castillo Cesar",
      piezas: [{ tipo: "Camisa manga larga", talla: "M" }],
    },
    {
      nombre: "Maria Paula",
      apellidos: "Fernandez Vargas",
      piezas: [{ tipo: "Camisa manga corta", talla: "M" }],
    },
    {
      nombre: "Karen Johanna",
      apellidos: "Aguilar",
      piezas: [
        { tipo: "Camisa manga larga", talla: "M" },
        { tipo: "Llaves del local", talla: null, nota: "Jefe de sala" },
      ],
    },
    {
      nombre: "Alejandro",
      apellidos: "Mojica",
      piezas: [
        { tipo: "Americana", talla: "L" },
        { tipo: "Teléfono móvil", talla: null },
        { tipo: "Ordenador", talla: null },
        { tipo: "Llaves del local", talla: null },
      ],
    },
  ],

  BACANAL: [
    {
      nombre: "Ezequiel",
      apellidos: "Falcone",
      piezas: [
        { tipo: "Camisa manga corta", talla: "M" },
        { tipo: "Camisa manga larga", talla: "M" },
        { tipo: "Llaves del local", talla: null, nota: "Jefe de sala" },
      ],
    },
    {
      // Sin camisa: es lo único que explica por qué no lleva uniforme de sala.
      // Sin entrega no hay fila donde apuntarlo, así que va en la de sus llaves.
      nombre: "David Kenny",
      apellidos: "Zapata Bernardo",
      piezas: [
        {
          tipo: "Llaves del local",
          talla: null,
          nota: "Jefe de sala. No se le entrega camisa por su complexión.",
        },
      ],
    },
    {
      nombre: "Marcos David",
      apellidos: "Vasile",
      piezas: [
        {
          tipo: "Llaves del local",
          talla: null,
          nota: "No se le entrega camisa por su complexión.",
        },
      ],
    },
    {
      nombre: "Yesmeri Maria",
      apellidos: "Peralta Martinez",
      piezas: [
        { tipo: "Mandil", talla: null, nota: "Limpieza" },
        { tipo: "Llaves del local", talla: null, nota: "Limpieza" },
      ],
    },
    {
      nombre: "Eduardo",
      apellidos: "Charro Correa",
      piezas: [
        { tipo: "Chaquetilla de cocina", talla: "M" },
        { tipo: "Gorro", talla: null },
      ],
    },
    {
      nombre: "Farid",
      apellidos: "Aghmir",
      piezas: [
        { tipo: "Chaquetilla de cocina", talla: "L", unidades: 2 },
        { tipo: "Gorro", talla: null },
        { tipo: "Llaves del local", talla: null },
      ],
    },
    {
      nombre: "Borja",
      apellidos: "Garrido",
      piezas: [
        { tipo: "Chaquetilla de cocina", talla: "XXL", unidades: 2 },
        { tipo: "Gorro", talla: null },
        { tipo: "Llaves del local", talla: null },
      ],
    },
    {
      nombre: "Alejandro",
      apellidos: "Mojica",
      piezas: [
        { tipo: "Teléfono móvil", talla: null },
        { tipo: "Ordenador", talla: null },
        { tipo: "Llaves del local", talla: null },
      ],
    },
  ],
};

function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

type TipoCatalogo = {
  id: string;
  nombre: string;
  categoria: "uniforme" | "material";
  requiere_talla: boolean | null;
  requiere_devolucion: boolean | null;
};

async function main() {
  const admin = createAdminClient();
  const fecha = hoyISO();
  const problemas: string[] = [];

  // ─── Quién figura como responsable ──────────────────────────
  const { data: usuarioRrhh } = await admin
    .from("usuarios")
    .select("user_id, nombre, apellidos, full_name")
    .eq("email", EMAIL_RRHH)
    .maybeSingle();

  if (!usuarioRrhh) {
    console.error(`✗ No existe el usuario ${EMAIL_RRHH}, que es quien figura como responsable.`);
    process.exit(1);
  }
  const u = usuarioRrhh as {
    user_id: string;
    nombre: string | null;
    apellidos: string | null;
    full_name: string | null;
  };
  const solicitanteNombre =
    `${u.nombre ?? ""} ${u.apellidos ?? ""}`.trim() || u.full_name || EMAIL_RRHH;

  console.log(APLICAR ? "MODO REAL — se crearán entregas y se enviarán correos\n" : "MODO PRUEBA — no se escribe nada ni se manda ningún correo\n");

  // ─── Plan por empresa, validando TODO antes de escribir ─────
  type Tarea = {
    empresa: string;
    empresaId: string;
    empleadoId: string;
    empleadoNombre: string;
    tipo: TipoCatalogo;
    talla: string | null;
    nota: string | null;
    aCrear: number;
    yaHay: number;
  };
  const tareas: Tarea[] = [];

  for (const [nombreEmpresa, empleados] of Object.entries(CARGA)) {
    const { data: empresa } = await admin
      .from("empresas")
      .select("id")
      .eq("nombre", nombreEmpresa)
      .maybeSingle();
    if (!empresa) {
      problemas.push(`No existe la empresa ${nombreEmpresa}`);
      continue;
    }
    const empresaId = (empresa as { id: string }).id;

    const { data: catalogo } = await admin
      .from("entregas_tipos_material")
      .select("id, nombre, categoria, requiere_talla, requiere_devolucion")
      .eq("empresa_id", empresaId)
      .eq("activo", true);
    const tipos = new Map<string, TipoCatalogo>();
    for (const t of (catalogo ?? []) as TipoCatalogo[]) {
      tipos.set(t.nombre.toLowerCase(), t);
    }

    for (const emp of empleados) {
      const { data: empleado } = await admin
        .from("empleados")
        .select("id, nombre, apellidos")
        .eq("empresa_id", empresaId)
        .eq("nombre", emp.nombre)
        .eq("apellidos", emp.apellidos)
        .maybeSingle();

      if (!empleado) {
        problemas.push(
          `${nombreEmpresa}: no existe la ficha de ${emp.nombre} ${emp.apellidos}`,
        );
        continue;
      }
      const e = empleado as { id: string; nombre: string; apellidos: string };
      const empleadoNombre = `${e.nombre} ${e.apellidos}`.trim();

      for (const pieza of emp.piezas) {
        const tipo = tipos.get(pieza.tipo.toLowerCase());

        // Cuadriculado: el tipo tiene que existir tal cual en el catálogo.
        if (!tipo) {
          problemas.push(
            `${nombreEmpresa} · ${empleadoNombre}: "${pieza.tipo}" no está en el catálogo`,
          );
          continue;
        }

        // Y la talla tiene que ser coherente con el tipo.
        if (tipo.requiere_talla) {
          if (!pieza.talla) {
            problemas.push(
              `${nombreEmpresa} · ${empleadoNombre}: ${tipo.nombre} necesita talla y no la tiene`,
            );
            continue;
          }
          if (!(TALLAS_ROPA as readonly string[]).includes(pieza.talla)) {
            problemas.push(
              `${nombreEmpresa} · ${empleadoNombre}: la talla "${pieza.talla}" de ${tipo.nombre} no está en el abanico (${TALLAS_ROPA.join(", ")})`,
            );
            continue;
          }
        } else if (pieza.talla) {
          problemas.push(
            `${nombreEmpresa} · ${empleadoNombre}: ${tipo.nombre} no lleva talla y se le ha puesto "${pieza.talla}"`,
          );
          continue;
        }

        // Repetible: solo se crea lo que falte.
        const { data: yaGrabadas } = await admin
          .from("entregas_material")
          .select("id, entregas_material_items!inner(tipo_id, talla)")
          .eq("empresa_id", empresaId)
          .eq("empleado_id", e.id)
          .eq("entregas_material_items.tipo_id", tipo.id);

        const mismas = ((yaGrabadas ?? []) as {
          entregas_material_items: { talla: string | null }[] | { talla: string | null };
        }[]).filter((fila) => {
          const item = Array.isArray(fila.entregas_material_items)
            ? fila.entregas_material_items[0]
            : fila.entregas_material_items;
          return (item?.talla ?? null) === (pieza.talla ?? null);
        }).length;

        const quiere = pieza.unidades ?? 1;
        const aCrear = Math.max(0, quiere - mismas);

        tareas.push({
          empresa: nombreEmpresa,
          empresaId,
          empleadoId: e.id,
          empleadoNombre,
          tipo,
          talla: pieza.talla,
          nota: pieza.nota ?? null,
          aCrear,
          yaHay: mismas,
        });
      }
    }
  }

  // ─── Si algo no cuadra, no se escribe NADA ──────────────────
  if (problemas.length > 0) {
    console.error("✗ Los datos no cuadran con el catálogo. No se ha tocado nada:\n");
    for (const p of problemas) console.error(`  · ${p}`);
    process.exit(1);
  }

  // ─── Qué se va a hacer ──────────────────────────────────────
  const total = tareas.reduce((n, t) => n + t.aCrear, 0);
  const yaEstaban = tareas.reduce((n, t) => n + t.yaHay, 0);

  let empresaActual = "";
  let empleadoActual = "";
  for (const t of tareas) {
    if (t.empresa !== empresaActual) {
      console.log(`\n${t.empresa}`);
      empresaActual = t.empresa;
      empleadoActual = "";
    }
    if (t.empleadoNombre !== empleadoActual) {
      console.log(`  ${t.empleadoNombre}`);
      empleadoActual = t.empleadoNombre;
    }
    const pieza = t.talla ? `${t.tipo.nombre} (${t.talla})` : t.tipo.nombre;
    const cuantas = t.aCrear === 0 ? "ya estaba" : `×${t.aCrear}`;
    console.log(`    · ${pieza} — ${cuantas}${t.nota ? `  «${t.nota}»` : ""}`);
  }

  console.log(
    `\n${total} entrega(s) por crear${yaEstaban ? `, ${yaEstaban} ya estaban grabadas` : ""}.`,
  );

  if (!APLICAR) {
    console.log("\nNada escrito. Repite con --aplicar para crearlas y mandar las actas.");
    return;
  }
  if (total === 0) {
    console.log("\nNo hay nada que crear.");
    return;
  }

  // ─── Crear y mandar a firmar ────────────────────────────────
  let creadas = 0;
  let enviadas = 0;
  const fallos: string[] = [];

  for (const t of tareas) {
    for (let i = 0; i < t.aCrear; i++) {
      const { data: cabecera, error } = await admin
        .from("entregas_material")
        .insert({
          empresa_id: t.empresaId,
          empleado_id: t.empleadoId,
          fecha,
          nota: t.nota,
          estado: "borrador",
          entregado_por: u.user_id,
          entregado_por_nombre: solicitanteNombre,
        })
        .select("id")
        .single();

      if (error || !cabecera) {
        fallos.push(`${t.empleadoNombre} · ${t.tipo.nombre}: ${error?.message ?? "sin id"}`);
        continue;
      }
      const entregaId = (cabecera as { id: string }).id;

      const { error: errorItem } = await admin.from("entregas_material_items").insert({
        entrega_id: entregaId,
        tipo_id: t.tipo.id,
        tipo_nombre: t.tipo.nombre,
        categoria: t.tipo.categoria,
        talla: t.talla,
        requiere_devolucion: t.tipo.requiere_devolucion ?? true,
      });
      if (errorItem) {
        // Una cabecera sin pieza no sirve para nada y ensuciaría la lista.
        await admin.from("entregas_material").delete().eq("id", entregaId);
        fallos.push(`${t.empleadoNombre} · ${t.tipo.nombre}: ${errorItem.message}`);
        continue;
      }
      creadas += 1;

      const firma = await enviarActaEntregaAFirma({
        variante: "entrega",
        entregaId,
        empresaId: t.empresaId,
        solicitanteUserId: u.user_id,
        solicitanteNombre,
      });

      if (!firma.ok) {
        fallos.push(`${t.empleadoNombre} · ${t.tipo.nombre}: acta no enviada — ${firma.error}`);
        continue;
      }

      await admin
        .from("entregas_material")
        .update({
          estado: "pendiente_firma",
          firma_id: firma.documentoId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entregaId);

      if (firma.emailEnviado) enviadas += 1;
      else fallos.push(`${t.empleadoNombre} · ${t.tipo.nombre}: acta creada pero el correo no salió`);
    }
  }

  console.log(`\n✓ ${creadas} entregas creadas, ${enviadas} actas enviadas por correo.`);
  if (fallos.length) {
    console.log(`\n⚠ ${fallos.length} con problemas:`);
    for (const f of fallos) console.log(`  · ${f}`);
    console.log("\nLas actas que no salieron se pueden reenviar desde RRHH → Entregas.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
