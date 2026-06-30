"use server";

import { getAppContext } from "@/lib/supabase/get-context";
import { revalidatePath } from "next/cache";
import {
  validarDocumento,
  validarIban,
  type TipoDocumento,
} from "@/features/mi-panel/lib/datos-personales-validators";
import { buscarBancoPorIban } from "@/features/mi-panel/data/bancos-espana";

export interface DatosPersonalesInput {
  nombre?: string | null;
  apellidos?: string | null;
  tipo_documento?: TipoDocumento | null;
  dni_nie?: string | null;
  fecha_nacimiento?: string | null;
  nacionalidad?: string | null;
  genero?: string | null;
  estado_civil?: string | null;
  numero_ss?: string | null;
  telefono?: string | null;
  telefono_empresa?: string | null;
  email_personal?: string | null;
  email_empresa?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  iban?: string | null;
  banco_codigo?: string | null;
  banco_nombre?: string | null;
  titular_cuenta?: string | null;
  emergencia_nombre?: string | null;
  emergencia_relacion?: string | null;
  emergencia_telefono?: string | null;
  talla_camiseta?: string | null;
  talla_pantalon?: string | null;
}

export interface GuardarDatosResultado {
  ok: boolean;
  error?: string;
}

function trim(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export async function guardarDatosPersonales(
  input: DatosPersonalesInput,
): Promise<GuardarDatosResultado> {
  try {
    // empleados es la fuente única de datos personales. usuarios es solo
    // acceso. Escribimos en la ficha de la empresa activa; un trigger de BD
    // replica los datos personales al resto de fichas del mismo user_id.
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return { ok: false, error: "Sesión no válida" };

    // Validación documento
    const tipoDoc = (trim(input.tipo_documento) as TipoDocumento) || null;
    const numDoc = trim(input.dni_nie);
    if (numDoc && tipoDoc) {
      const r = validarDocumento(tipoDoc, numDoc);
      if (!r.valido) return { ok: false, error: r.mensaje ?? "Documento inválido" };
    } else if (numDoc && !tipoDoc) {
      return { ok: false, error: "Selecciona el tipo de documento" };
    }

    // Validación IBAN + resolución de banco
    const iban = trim(input.iban)?.replace(/\s+/g, "").toUpperCase() ?? null;
    let bancoCodigo: string | null = trim(input.banco_codigo);
    let bancoNombre: string | null = trim(input.banco_nombre);
    if (iban) {
      const r = validarIban(iban);
      if (!r.valido) return { ok: false, error: r.mensaje ?? "IBAN inválido" };
      const banco = buscarBancoPorIban(iban);
      if (banco) {
        bancoCodigo = banco.codigo;
        bancoNombre = banco.nombre;
      }
    }

    // Comprobación de IBAN duplicado dentro de la empresa: evita que la nómina
    // de un trabajador caiga en la cuenta de otro por error o suplantación.
    if (iban && empresaId) {
      const { data: choque } = await supabase
        .from("empleados")
        .select("user_id, nombre, apellidos")
        .eq("empresa_id", empresaId)
        .eq("iban", iban)
        .neq("user_id", userId)
        .maybeSingle();
      if (choque) {
        const otro = `${choque.nombre ?? ""} ${choque.apellidos ?? ""}`.trim() || "otro empleado";
        return {
          ok: false,
          error: `Ese IBAN ya está registrado a nombre de ${otro}. Avisa a RRHH si es un error.`,
        };
      }
    }

    const tallaCamiseta = trim(input.talla_camiseta);
    // payload sobre columnas de `empleados`. emergencia_* del portal mapea a
    // contacto_emergencia_*; talla_uniforme refleja la talla de camiseta.
    const payload = {
      nombre: trim(input.nombre),
      apellidos: trim(input.apellidos),
      tipo_documento: tipoDoc,
      dni_nie: numDoc,
      fecha_nacimiento: trim(input.fecha_nacimiento),
      nacionalidad: trim(input.nacionalidad),
      genero: trim(input.genero),
      estado_civil: trim(input.estado_civil),
      numero_ss: trim(input.numero_ss),
      telefono: trim(input.telefono),
      telefono_empresa: trim(input.telefono_empresa),
      email_personal: trim(input.email_personal),
      email_empresa: trim(input.email_empresa),
      direccion: trim(input.direccion),
      codigo_postal: trim(input.codigo_postal),
      ciudad: trim(input.ciudad),
      provincia: trim(input.provincia),
      pais: trim(input.pais),
      iban,
      banco_codigo: bancoCodigo,
      banco_nombre: bancoNombre,
      titular_cuenta: trim(input.titular_cuenta),
      contacto_emergencia_nombre: trim(input.emergencia_nombre),
      contacto_emergencia_relacion: trim(input.emergencia_relacion),
      contacto_emergencia_telefono: trim(input.emergencia_telefono),
      talla_camiseta: tallaCamiseta,
      talla_pantalon: trim(input.talla_pantalon),
      talla_uniforme: tallaCamiseta,
      updated_at: new Date().toISOString(),
    };

    // Escribe en la ficha de empleado de la empresa activa. El trigger de BD
    // replica los datos personales a las demás fichas del mismo user_id.
    let q = supabase.from("empleados").update(payload).eq("user_id", userId);
    if (empresaId) q = q.eq("empresa_id", empresaId);
    const { error } = await q;

    if (error) {
      console.error("[guardarDatosPersonales] update error", error);
      return { ok: false, error: error.message };
    }

    revalidatePath("/mi-panel/datos-personales");
    return { ok: true };
  } catch (err) {
    console.error("[guardarDatosPersonales] excepción", err);
    const msg = err instanceof Error ? err.message : "Error inesperado al guardar";
    return { ok: false, error: msg };
  }
}

export interface DatosPersonalesCompletos {
  nombre: string | null;
  apellidos: string | null;
  email: string | null;
  tipo_documento: TipoDocumento | null;
  dni_nie: string | null;
  fecha_nacimiento: string | null;
  nacionalidad: string | null;
  genero: string | null;
  estado_civil: string | null;
  numero_ss: string | null;
  telefono: string | null;
  telefono_empresa: string | null;
  email_personal: string | null;
  email_empresa: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  iban: string | null;
  banco_codigo: string | null;
  banco_nombre: string | null;
  titular_cuenta: string | null;
  iban_verificado: boolean;
  emergencia_nombre: string | null;
  emergencia_relacion: string | null;
  emergencia_telefono: string | null;
  talla_camiseta: string | null;
  talla_pantalon: string | null;
}

export async function cargarDatosPersonales(): Promise<DatosPersonalesCompletos | null> {
  try {
    const { supabase, userId, empresaId } = await getAppContext();
    if (!userId) return null;

    // Datos personales: desde la ficha de empleado de la empresa activa.
    let q = supabase
      .from("empleados")
      .select(
        "nombre, apellidos, tipo_documento, dni_nie, fecha_nacimiento, nacionalidad, genero, estado_civil, numero_ss, telefono, telefono_empresa, email_personal, email_empresa, direccion, codigo_postal, ciudad, provincia, pais, iban, banco_codigo, banco_nombre, titular_cuenta, iban_verificado, contacto_emergencia_nombre, contacto_emergencia_relacion, contacto_emergencia_telefono, talla_camiseta, talla_pantalon",
      )
      .eq("user_id", userId);
    if (empresaId) q = q.eq("empresa_id", empresaId);
    const { data, error } = await q.limit(1).maybeSingle();
    if (error) {
      console.error("[cargarDatosPersonales] error", error);
      return null;
    }
    if (!data) return null;

    // email de cuenta (login) sigue viviendo en usuarios.
    const { data: cuenta } = await supabase
      .from("usuarios")
      .select("email")
      .eq("user_id", userId)
      .maybeSingle();

    return {
      nombre: data.nombre,
      apellidos: data.apellidos,
      email: cuenta?.email ?? null,
      tipo_documento: data.tipo_documento as TipoDocumento | null,
      dni_nie: data.dni_nie,
      fecha_nacimiento: data.fecha_nacimiento,
      nacionalidad: data.nacionalidad,
      genero: data.genero,
      estado_civil: data.estado_civil,
      numero_ss: data.numero_ss,
      telefono: data.telefono,
      telefono_empresa: data.telefono_empresa,
      email_personal: data.email_personal,
      email_empresa: data.email_empresa,
      direccion: data.direccion,
      codigo_postal: data.codigo_postal,
      ciudad: data.ciudad,
      provincia: data.provincia,
      pais: data.pais,
      iban: data.iban,
      banco_codigo: data.banco_codigo,
      banco_nombre: data.banco_nombre,
      titular_cuenta: data.titular_cuenta,
      iban_verificado: Boolean(data.iban_verificado),
      emergencia_nombre: data.contacto_emergencia_nombre,
      emergencia_relacion: data.contacto_emergencia_relacion,
      emergencia_telefono: data.contacto_emergencia_telefono,
      talla_camiseta: data.talla_camiseta,
      talla_pantalon: data.talla_pantalon,
    } as DatosPersonalesCompletos;
  } catch (err) {
    console.error("[cargarDatosPersonales] excepción", err);
    return null;
  }
}
